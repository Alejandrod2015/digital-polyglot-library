export const runtime = "nodejs";

/**
 * Ejercicio de speaking: UN turno hablado por palabra (piloto 2026-09-14).
 *
 * Dos acciones y nada mas:
 *   "question"  el personaje de la historia donde el usuario guardo la palabra
 *               hace una pregunta que la pide, sin nombrarla (G1). Se cachea en
 *               `SpeakingPrompt` por (idioma, palabra, historia) para no pagar
 *               dos veces lo mismo.
 *   "grade"     Whisper transcribe la respuesta y la ruta califica. Primero
 *               determinista; el LLM solo entra si eso falla, y no puede
 *               aprobar solo (G5).
 *
 * Lo que esta ruta NO hace: audio. El cliente le pide la voz de la pregunta a
 * `/api/practice/sentence-tts`, que ya cae a la voz aprobada del idioma y
 * cachea en R2. Aqui no se llama a ElevenLabs ni se elige voz nueva (G4).
 *
 * Gate de plan del piloto: solo `polyglot` (y `owner`). El movil ademas no
 * mete el slot en la sesion de los demas, asi que nadie llega a ver un 403.
 */

import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { serializeEntitlement } from "@/lib/billing";
import { getActiveMobileSession, type MobileSessionPayload } from "@/lib/mobileSession";
import { getIsoLanguageTag } from "@/lib/languageFlags";
import { chatCompletion, extractJSON } from "@/agents/config/llmProvider";
import { prisma } from "@/lib/prisma";
import {
  clampFeedback,
  gradeDeterministic,
  questionLeaksWord,
  stripLongDashes,
  verifyLlmForm,
} from "@/lib/speakingGrading";
import type { Plan } from "@domain/access";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Cap the uploaded clip so a malformed/oversized payload can't blow up
// memory or the Whisper bill. ~12s of m4a is well under 1 MB; 6 MB is a
// generous ceiling that still rejects accidental large uploads.
const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

/**
 * G2: el prompt recibe el nivel de la HISTORIA y la banda gramatical de ese
 * nivel, no las preferencias del usuario. Una palabra guardada en un A1 se
 * pregunta en A1 aunque quien practica se crea B2.
 */
const GRAMMAR_BAND: Record<string, string> = {
  a0: "present tense only, 3 to 6 words, no subordinate clauses",
  a1: "present tense, simple past of the most common verbs, one clause",
  a2: "present, past and near future; one subordinate clause at most",
  b1: "past tenses, conditional, common subjunctive; two clauses at most",
  b2: "full tense range including subjunctive; natural everyday register",
  c1: "any tense and register, idiomatic phrasing allowed",
};

function bandForLevel(level: string): string {
  return GRAMMAR_BAND[level.trim().toLowerCase()] ?? GRAMMAR_BAND.a2;
}

function isPlan(value: unknown): value is Exclude<Plan, undefined> {
  return (
    value === "free" ||
    value === "basic" ||
    value === "premium" ||
    value === "polyglot" ||
    value === "owner"
  );
}

// Resolve the live plan (not the possibly-stale token plan) so a mid-week
// upgrade unlocks immediately and a downgrade locks immediately. Mirrors
// the resolution in /api/mobile/billing/entitlement.
async function resolveEffectivePlan(session: MobileSessionPayload): Promise<Plan> {
  const [entitlement, user] = await Promise.all([
    prisma.billingEntitlement.findUnique({ where: { userId: session.sub } }),
    clerkClient.users.getUser(session.sub).catch(() => null),
  ]);
  const serialized = serializeEntitlement(entitlement);
  const metadataPlan = user?.publicMetadata?.plan;
  return isPlan(metadataPlan) ? metadataPlan : serialized.plan;
}

function whisperLanguageHint(language: string): string | undefined {
  const iso = getIsoLanguageTag(language).toLowerCase();
  return iso === "??" ? undefined : iso;
}

type QuestionBody = {
  action: "question";
  word?: string;
  surface?: string | null;
  translation?: string;
  sentence?: string;
  storySlug?: string;
  language?: string;
};

type GradeBody = {
  action: "grade";
  word?: string;
  surface?: string | null;
  question?: string;
  sentence?: string;
  language?: string;
  audioBase64?: string;
  mimeType?: string;
};

type CastMemberRow = { name?: unknown; present?: unknown };

/**
 * G3: quien pregunta. El hablante de la frase de ejemplo si se puede resolver
 * (su nombre aparece en la frase), si no el primer personaje del reparto. Sin
 * reparto no se inventa a nadie: pregunta el narrador, sin nombre.
 */
function resolveCharacterName(cast: unknown, sentence: string): string | null {
  const characters =
    cast && typeof cast === "object" && Array.isArray((cast as { characters?: unknown }).characters)
      ? ((cast as { characters: CastMemberRow[] }).characters)
      : [];
  const names = characters
    .filter((member) => member?.present !== false)
    .map((member) => (typeof member?.name === "string" ? member.name.trim() : ""))
    .filter((name) => name.length > 0);
  if (names.length === 0) return null;

  const haystack = sentence.toLowerCase();
  const spoken = names.find((name) => haystack.includes(name.toLowerCase()));
  return spoken ?? names[0];
}

function buildQuestionMessages(params: {
  language: string;
  level: string;
  translation: string;
  sentence: string;
  characterName: string | null;
  bandHint: string;
  retry: boolean;
}) {
  const who = params.characterName
    ? `You are ${params.characterName}, a character from the story the learner just read.`
    : "You are the narrator of the story the learner just read.";
  return [
    {
      role: "system" as const,
      content:
        `${who} ` +
        `Ask the learner ONE short question, entirely in ${params.language}, whose natural answer ` +
        `uses the word that means "${params.translation}" in English. ` +
        `This line from the story is the context: "${params.sentence}". ` +
        `Grammar band for this story's level (${params.level}): ${params.bandHint}. ` +
        `HARD RULE: the question must NOT contain that word, any inflected form of it, ` +
        `or its English translation. The learner has to retrieve it, not read it. ` +
        (params.retry
          ? `Your previous attempt contained the word. Rewrite it around the word instead. `
          : "") +
        `Output ONLY the question in ${params.language}: one sentence, no translation, ` +
        `no greeting, no quotation marks, no long dashes, no extra text.`,
    },
    { role: "user" as const, content: "Ask your question now." },
  ];
}

/**
 * El prompt de calificar tiene DOS ramas, y confundirlas se paga en pantalla.
 *
 * Cuando `gradeDeterministic` ya encontro la palabra, el veredicto esta cerrado
 * y al modelo solo se le pide la linea de feedback. Decirle ahi que "la
 * comparacion literal no la encontro" era falso y le daba pie a devolver la
 * frase modelo del FALLO encima de una respuesta correcta: el usuario acertaba
 * y leia la correccion de un error que no cometio.
 */
export function buildGradeMessages(params: {
  language: string;
  word: string;
  surface?: string | null;
  question: string;
  sentence: string;
  transcript: string;
  /** true cuando la comparacion literal ya dio la palabra por dicha. */
  deterministicHit: boolean;
  /** Forma exacta hallada, cuando `deterministicHit` es true. */
  formFound?: string | null;
}) {
  const forms = [params.word, params.surface ?? ""].filter(Boolean).join(" / ");
  const comun =
    `A learner of ${params.language} was asked out loud: "${params.question}". ` +
    `Their spoken answer, transcribed, is: "${params.transcript}". ` +
    `The target word is "${forms}". `;
  const cierre = `Do not mention that the answer was transcribed. No long dashes.`;

  const content = params.deterministicHit
    ? comun +
      `They DID use the word: it appears in the transcription as "${params.formFound ?? forms}". ` +
      `The answer is already marked correct, so do not judge it again and do not correct the word. ` +
      `Reply with a strict JSON object (no markdown fences) of shape {"feedback": string}. ` +
      `"feedback" is ONE line in ENGLISH, under 20 words: a more natural way to say what they said ` +
      `if there was a slip, or just "Nice" if there was not. ` +
      `Never give them a model sentence and never suggest they missed the word. ` +
      cierre
    : comun +
      `A literal comparison did not find it, so decide whether ` +
      `the answer nevertheless uses that word in some inflected or spelled-out form. ` +
      `Reply with a strict JSON object (no markdown fences) of shape ` +
      `{"formFound": string, "feedback": string}. ` +
      `"formFound" is the EXACT substring of the transcription that is a form of the target word, ` +
      `copied character for character from the transcription. If there is none, use "". ` +
      `Never invent a form that is not in the transcription. ` +
      `"feedback" is ONE line in ENGLISH, under 20 words. If they used the word, give a more ` +
      `natural version of what they said, or say "Nice" if there was no slip. If they did not, ` +
      `give them this model sentence with the word: "${params.sentence}". ` +
      cierre;

  return [
    { role: "system" as const, content },
    { role: "user" as const, content: "Grade it now." },
  ];
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!openai) {
    return NextResponse.json({ error: "Speaking practice is not available." }, { status: 503 });
  }

  const plan = await resolveEffectivePlan(session);
  if (plan !== "polyglot" && plan !== "owner") {
    return NextResponse.json({ error: "Speaking practice is a Polyglot feature." }, { status: 403 });
  }

  let body: QuestionBody | GradeBody;
  try {
    body = (await req.json()) as QuestionBody | GradeBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const language = (body.language || "").trim();
  if (!language) {
    return NextResponse.json({ error: "Missing language." }, { status: 400 });
  }

  try {
    if (body.action === "question") {
      return await handleQuestion(body, language);
    }
    if (body.action === "grade") {
      return await handleGrade(body, language);
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("Error en POST /api/mobile/speaking:", err);
    return NextResponse.json({ error: "Speaking practice failed." }, { status: 500 });
  }
}

async function handleQuestion(body: QuestionBody, language: string): Promise<Response> {
  const word = (body.word || "").trim();
  const surface = (body.surface || "").trim() || null;
  const translation = (body.translation || "").trim();
  const sentence = (body.sentence || "").trim();
  const storySlug = (body.storySlug || "").trim();

  if (!word || !translation || !sentence || !storySlug) {
    return NextResponse.json(
      { error: "word, translation, sentence and storySlug are required." },
      { status: 400 }
    );
  }

  const cached = await prisma.speakingPrompt.findUnique({
    where: { language_word_storySlug: { language, word, storySlug } },
  });
  if (cached) {
    return NextResponse.json({
      question: cached.question,
      characterName: cached.characterName,
      voiceId: cached.voiceId || null,
      cached: true,
    });
  }

  // G2: sin historia de journey no hay nivel, ni reparto, ni voz. El builder ya
  // filtra los favoritos de libro; esto cierra la puerta por el otro lado.
  const story = await prisma.journeyStory.findFirst({
    where: { slug: storySlug },
    select: { level: true, cast: true, voiceId: true, practiceVoiceId: true },
  });
  if (!story) {
    return NextResponse.json(
      { error: "No journey story for this word.", code: "NO_JOURNEY_STORY" },
      { status: 404 }
    );
  }

  const level = (story.level || "a2").trim();
  const characterName = resolveCharacterName(story.cast, sentence);
  // G4: la voz es la de la historia. La ruta de audio ya cae a la voz aprobada
  // del idioma cuando esta viene vacia; aqui no se elige ninguna voz nueva.
  const voiceId = (story.practiceVoiceId || story.voiceId || "").trim();

  const ask = async (retry: boolean): Promise<string> => {
    const raw = await chatCompletion(
      buildQuestionMessages({
        language,
        level,
        translation,
        sentence,
        characterName,
        bandHint: bandForLevel(level),
        retry,
      }),
      { temperature: 0.8, maxTokens: 120 }
    );
    return stripLongDashes(raw.replace(/^["'\s]+|["'\s]+$/g, ""));
  };

  // G1: una sola regeneracion. Si la segunda tambien filtra la palabra, el
  // problema no es la suerte: el ejercicio cae a `context` para esa palabra,
  // que el builder ya sabe armar.
  let question = await ask(false);
  if (questionLeaksWord(question, word, surface)) {
    question = await ask(true);
  }
  if (questionLeaksWord(question, word, surface)) {
    return NextResponse.json({ fallbackToContext: true }, { status: 200 });
  }

  await prisma.speakingPrompt
    .create({
      data: { language, word, storySlug, question, characterName, voiceId, level },
    })
    .catch(() => {
      // Carrera con otra sesion sobre la misma clave unica: la pregunta ya
      // esta guardada y la que devolvemos sirve igual.
    });

  return NextResponse.json({
    question,
    characterName,
    voiceId: voiceId || null,
    cached: false,
  });
}

async function handleGrade(body: GradeBody, language: string): Promise<Response> {
  const word = (body.word || "").trim();
  const surface = (body.surface || "").trim() || null;
  const question = (body.question || "").trim();
  const sentence = (body.sentence || "").trim();

  if (!word || !question) {
    return NextResponse.json({ error: "word and question are required." }, { status: 400 });
  }
  if (!body.audioBase64) {
    return NextResponse.json({ error: "Missing audio." }, { status: 400 });
  }

  const audioBuffer = Buffer.from(body.audioBase64, "base64");
  if (audioBuffer.length === 0) {
    return NextResponse.json({ error: "Empty audio." }, { status: 400 });
  }
  if (audioBuffer.length > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio clip too large." }, { status: 413 });
  }

  const mime = body.mimeType || "audio/m4a";
  const ext = mime.includes("wav") ? "wav" : mime.includes("mp") ? "mp3" : "m4a";
  const file = new File([new Uint8Array(audioBuffer)], `answer.${ext}`, { type: mime });

  const transcription = await openai!.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: whisperLanguageHint(language),
  });
  const transcript = (typeof transcription.text === "string" ? transcription.text : "").trim();

  // Silencio: el cliente da UN reintento sin penalizar y solo el segundo
  // vacio cuenta como fallo, asi que aqui no se decide nada todavia.
  if (!transcript) {
    return NextResponse.json({
      transcript: "",
      empty: true,
      correct: false,
      formFound: null,
      feedback: "I couldn't hear you. Try again a little closer to the mic.",
    });
  }

  // G5, primera pasada: determinista. Si acierta, ni se llama al modelo para
  // el veredicto; solo para la linea de feedback.
  const deterministic = gradeDeterministic(transcript, word, surface);

  const raw = await chatCompletion(
    buildGradeMessages({
      language,
      word,
      surface,
      question,
      sentence,
      transcript,
      deterministicHit: deterministic.correct,
      formFound: deterministic.formFound,
    }),
    { temperature: 0.3, maxTokens: 200 }
  );

  let llmForm = "";
  let feedback = "";
  try {
    const parsed = extractJSON<{ formFound?: string; feedback?: string }>(raw);
    llmForm = (parsed.formFound || "").trim();
    feedback = (parsed.feedback || "").trim();
  } catch {
    // Sin JSON limpio no hay forma que verificar: el veredicto se queda con lo
    // que dijo la comparacion literal, que es la que manda.
  }

  // G5, segunda pasada: el LLM nunca aprueba solo. Su forma tiene que estar en
  // la transcripcion para que cuente.
  const verdict = deterministic.correct ? deterministic : verifyLlmForm(transcript, llmForm);

  return NextResponse.json({
    transcript,
    correct: verdict.correct,
    formFound: verdict.formFound,
    feedback: clampFeedback(feedback) || (verdict.correct ? "Nice." : sentence),
  });
}
