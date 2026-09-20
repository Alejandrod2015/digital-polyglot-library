/**
 * Los ejercicios curados de una historia (`StoryPracticeSet`), en la forma
 * `PracticeExercise` que consumen la web y el movil. Vivia dentro de
 * `api/story-practice/route.ts`; se saco aqui el 2026-09-20 para que la
 * prueba de nivel sirva EXACTAMENTE los mismos ejercicios que la practica
 * (mismo barajado determinista, misma politica de clips, misma voz), en
 * vez de un formato propio.
 */
import { prisma } from "@/lib/prisma";
import type { PracticeExercise } from "@/lib/practiceExercises";
import { buildSentenceTranslationMap } from "@/lib/sentenceTranslation";

// Deterministic option shuffle. Curated/persisted sets often store the
// correct answer as options[0] (it's the natural way to author them), and the
// reader renders options in array order; so without this the right answer
// always lands in the same (top-left) slot across every exercise, which is an
// obvious giveaway. Seeding the shuffle on the exercise id keeps the order
// STABLE across reloads (no jarring reshuffle) while varying it per exercise,
// and makes the fix immune to how any future seed is authored. The answer is
// matched by value downstream, never by index, so reordering is safe.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleOptionsDeterministic(options: string[], seedStr: string): string[] {
  if (options.length < 2) return options;
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = mulberry32(h);
  const out = [...options];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Deterministic permutation of [0..n-1] for the given seed, so options AND any
// parallel array (e.g. optionTranslations) can be shuffled together; otherwise
// the English gloss ends up under the wrong word.
export function shuffleIndices(n: number, seedStr: string): number[] {
  return shuffleOptionsDeterministic(Array.from({ length: n }, (_, i) => String(i)), seedStr).map(Number);
}

// Match meanings render index-aligned with the words column, so if the meaning
// at row i is the answer for the word at row i the pairing is trivially given
// away (just tap straight across). Derange the meanings column: deterministic
// shuffle, then rotate until NO row's meaning equals that row's answer. This
// guarantees the spatial alignment is broken while staying stable across
// reloads and varied per exercise.
export function derangeMeanings(answersInRowOrder: string[], seedStr: string): string[] {
  const n = answersInRowOrder.length;
  if (n < 2) return [...answersInRowOrder];
  let order = shuffleOptionsDeterministic(answersInRowOrder, `${seedStr}:m`);
  let guard = 0;
  while (order.some((m, i) => m === answersInRowOrder[i]) && guard < n) {
    order = [...order.slice(1), order[0]];
    guard++;
  }
  return order;
}

export async function loadSentenceTranslations(storySlug: string): Promise<Record<string, string>> {
  if (!storySlug) return {};
  const set = await prisma.storyPracticeSet
    .findFirst({
      where: { story: { slug: storySlug, status: "published" } },
      select: {
        sentenceTranslations: true,
        exercises: { select: { type: true, word: true, payload: true } },
      },
    })
    .catch(() => null);
  if (!set) return {};
  return Object.fromEntries(
    buildSentenceTranslationMap({ column: set.sentenceTranslations, exercises: set.exercises })
  );
}

type PersistedExerciseRow = {
  id: string;
  type: string;
  word: string;
  sentence: string;
  payload: unknown;
  audioUrl: string | null;
};

const EXERCISE_ROW_SELECT = {
  id: true,
  type: true,
  word: true,
  sentence: true,
  payload: true,
  audioUrl: true,
} as const;

export async function loadPersistedExercises(
  storySlug: string,
  featuredOnly: boolean
): Promise<PracticeExercise[] | null> {
  if (!storySlug) return null;
  // featuredOnly=true → the ~10 that surface end-of-story. featuredOnly=false →
  // the POOL (the rest), shown when the user taps Practice for the story.
  // Migration 20260518180000 defaults featured=true so pre-migration sets keep
  // their full set in the featured bucket.
  const set = await prisma.storyPracticeSet.findFirst({
    where: { story: { slug: storySlug, status: "published" } },
    include: {
      exercises: {
        where: { featured: featuredOnly },
        orderBy: { orderIndex: "asc" },
        // Explicit select: only the columns this loop reads. The Fase-1
        // additive columns (cefr/audioText/audioVoiceId/distractorSource)
        // exist in the Prisma schema/client but are NOT migrated to prod
        // yet, so an `include` (which selects every scalar) throws "column
        // cefr does not exist". Scoping the select keeps this route working
        // on the un-migrated DB and after the migration alike.
        select: EXERCISE_ROW_SELECT,
      },
    },
  });
  if (!set || set.exercises.length === 0) return null;

  // #6 (audit 2026-07-24): los pares de match nunca traían voiceId (904/904
  // vacíos), así que el audio de palabra de match caía a la voz fallback
  // colombiana (Hernando) en vez del narrador de la historia; acento
  // equivocado en journeys ES no-colombianos. Estampamos la voz del narrador
  // (misma resolución que la ruta live: practiceVoiceId gana sobre voiceId) en
  // cada par para que suene en la voz correcta, sin depender de rebuild mobile.
  const journeyVoice = await prisma.journeyStory.findFirst({
    where: { slug: storySlug },
    select: { voiceId: true, practiceVoiceId: true, journey: { select: { language: true } } },
  }).catch(() => null);
  const storyVoiceId = journeyVoice?.practiceVoiceId?.trim() || journeyVoice?.voiceId || null;
  // Idioma del journey para los pares de match. Sin el, la web llamaba a
  // word-tts sin `language` y el endpoint asumia espanol: "binario" (IT) con
  // fonetica ajena (2026-09-17). El mobile ya mandaba el idioma del journey.
  const storyLanguage = journeyVoice?.journey?.language ?? null;

  return mapPersistedExercises(storySlug, set.exercises, storyVoiceId, storyLanguage);
}

/**
 * The same exercises for MANY published stories in two queries instead of
 * two per story: sets with every exercise (featured first, then the pool)
 * and the narrator voice per story. Added for the level test (2026-09-20),
 * which reads a dozen stories per call; one call went from ~45 queries to 3.
 */
export async function loadPersistedExercisesForSlugs(
  storySlugs: string[]
): Promise<Map<string, PracticeExercise[]>> {
  const out = new Map<string, PracticeExercise[]>();
  if (storySlugs.length === 0) return out;
  const sets = await prisma.storyPracticeSet.findMany({
    where: { story: { slug: { in: storySlugs }, status: "published" } },
    select: {
      story: {
        select: { slug: true, voiceId: true, practiceVoiceId: true, journey: { select: { language: true } } },
      },
      exercises: {
        orderBy: [{ featured: "desc" }, { orderIndex: "asc" }],
        select: EXERCISE_ROW_SELECT,
      },
    },
  });
  for (const set of sets) {
    const slug = set.story.slug;
    if (!slug || set.exercises.length === 0) continue;
    const voice = set.story.practiceVoiceId?.trim() || set.story.voiceId || null;
    out.set(slug, mapPersistedExercises(slug, set.exercises, voice, set.story.journey?.language ?? null));
  }
  return out;
}

/** Rows of one set, in the shape the clients consume (pure). */
function mapPersistedExercises(
  storySlug: string,
  rows: PersistedExerciseRow[],
  storyVoiceId: string | null,
  storyLanguage: string | null
): PracticeExercise[] {
  const out: PracticeExercise[] = [];
  for (const row of rows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
    // Inject the persisted R2 mp3 url into the audioClip so the mobile
    // client can play it directly without hitting Modal Piper at
    // runtime. Modal cold-starts caused intermittent silent plays; the
    // editor pre-generates these audios from Studio so by the time a
    // user reaches the exercise, the mp3 is already on R2.
    //
    // Two pre-generation pipelines write the persisted mp3 to different
    // places: the Modal/Piper script writes the `audioUrl` COLUMN, while the
    // ElevenLabs narrator pipeline (_genPracticeClips.ts) writes
    // `payload.audioClip.clipUrl`. The mobile client only plays `cachedUrl`,
    // so cachedUrl must fall back to clipUrl or every ElevenLabs-rendered
    // journey (e.g. German) plays silent even though the clip exists.
    const rawClip = (payload.audioClip ?? null) as Record<string, unknown> | null;
    const rawClipUrl = typeof rawClip?.clipUrl === "string" ? rawClip.clipUrl : null;
    // POLICY 2026-07-24 (solo ElevenLabs, discriminador A): `row.audioUrl` es la
    // COLUMNA que llena el pipeline Modal/Piper (motor LOCAL, no ElevenLabs),
    // mientras `payload.audioClip.clipUrl` es el clip de ElevenLabs. Antes se
    // prefería `row.audioUrl ?? rawClipUrl` → el cliente reproducía el mp3 de
    // Piper. Ahora usamos SOLO el clip EL; sin él, el cliente cae a sentence-tts
    // (ya EL-only) → nunca suena Piper. Muta los ~391 clips Modal pre-horneados.
    const persistedClipUrl = rawClipUrl;
    const audioClip = rawClip
      ? { ...rawClip, cachedUrl: persistedClipUrl }
      : (persistedClipUrl ? { cachedUrl: persistedClipUrl } : null);
    switch (row.type) {
      case "fill_blank": {
        const rawOptions = Array.isArray(payload.options) ? (payload.options as string[]) : [];
        const rawTr = Array.isArray(payload.optionTranslations) ? (payload.optionTranslations as string[]) : null;
        const order = shuffleIndices(rawOptions.length, row.id);
        const options = order.map((i) => rawOptions[i]);
        const optionTranslations = rawTr ? order.map((i) => rawTr[i]) : null;
        const answer = typeof payload.answer === "string" ? payload.answer : row.word;
        out.push({
          id: `fill_blank:${row.id}`,
          type: "fill_blank",
          prompt,
          sentence: row.sentence,
          translation: typeof payload.translation === "string" ? payload.translation : null,
          optionTranslations,
          storySlug,
          audioClip: audioClip as PracticeExercise extends { audioClip?: infer T } ? T : never,
          options,
          answer,
        });
        break;
      }
      case "meaning_in_context": {
        const rawOptions = Array.isArray(payload.options) ? (payload.options as string[]) : [];
        const options = shuffleOptionsDeterministic(rawOptions, row.id);
        const answer = typeof payload.answer === "string" ? payload.answer : "";
        out.push({
          id: `meaning_in_context:${row.id}`,
          type: "meaning_in_context",
          prompt,
          word: row.word,
          sentence: row.sentence,
          storySlug,
          audioClip: audioClip as PracticeExercise extends { audioClip?: infer T } ? T : never,
          options,
          answer,
        });
        break;
      }
      case "listen_choose": {
        const rawOptions = Array.isArray(payload.options) ? (payload.options as string[]) : [];
        const rawTr = Array.isArray(payload.optionTranslations) ? (payload.optionTranslations as string[]) : null;
        const order = shuffleIndices(rawOptions.length, row.id);
        const options = order.map((i) => rawOptions[i]);
        const optionTranslations = rawTr ? order.map((i) => rawTr[i]) : null;
        const answer = typeof payload.answer === "string" ? payload.answer : row.word;
        const language = typeof payload.language === "string" ? payload.language : null;
        // #7a (audit 2026-07-24): 9 sets DE tienen el `sentence` top-level VACÍO
        // (la oración vive en payload.audioClip.sentence) → speechText vacío →
        // el cliente hace `if (!speechText) return` = botón MUDO. Caemos a la
        // oración del audioClip (y a la palabra como último recurso) para que
        // NUNCA quede vacío. Server-only: des-muta los 9 sin re-seed ni rebuild.
        const rawSentence = typeof row.sentence === "string" ? row.sentence.trim() : "";
        const clipSentence =
          rawClip && typeof rawClip.sentence === "string" ? rawClip.sentence.trim() : "";
        const speechText = rawSentence || clipSentence || row.word || "";
        out.push({
          id: `listen_choose:${row.id}`,
          type: "listen_choose",
          prompt,
          speechText,
          language,
          options,
          optionTranslations,
          audioClip: audioClip as PracticeExercise extends { audioClip?: infer T } ? T : never,
          answer,
        });
        break;
      }
      case "match_meaning": {
        const rawPairs = Array.isArray(payload.pairs) ? (payload.pairs as Array<{ word: string; answer: string; options: string[] }>) : [];
        // The meanings column renders from each pair's `options[index]`, aligned
        // by row with the words column. Replace options with a deranged order so
        // no meaning sits straight across from its own word. Answers are matched
        // by value downstream, so reordering the displayed meanings is safe.
        const answersInRowOrder = rawPairs.map((p) => p.answer);
        const deranged = derangeMeanings(answersInRowOrder, row.id);
        // #6: estampar la voz del narrador en cada par (preservando cualquier
        // voiceId/wordClipUrl ya presente en el payload). Sin esto el audio de
        // palabra de match sonaba en la voz fallback, no la del narrador.
        const pairs = rawPairs.map((p) => {
          const raw = p as Record<string, unknown>;
          return {
            ...p,
            options: deranged,
            voiceId: (typeof raw.voiceId === "string" && raw.voiceId) || storyVoiceId,
            wordVoiceId: (typeof raw.wordVoiceId === "string" && raw.wordVoiceId) || storyVoiceId,
            language: (typeof raw.language === "string" && raw.language) || storyLanguage,
          };
        });
        out.push({
          id: `match_meaning:${row.id}`,
          type: "match_meaning",
          prompt,
          pairs,
        });
        break;
      }
    }
  }
  return out;
}
