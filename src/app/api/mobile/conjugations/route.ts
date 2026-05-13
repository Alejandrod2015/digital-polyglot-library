export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import { prisma } from "@/lib/prisma";

type Body = {
  word?: unknown;
  language?: unknown;
};

type ConjugationForm = {
  person: string;
  form: string;
};

type ConjugationTense = {
  name: string;
  forms: ConjugationForm[];
};

type ConjugationPayload = {
  infinitive: string;
  translation: string;
  tenses: ConjugationTense[];
};

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

function normalizeLanguage(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeWord(value: string): string {
  return value.trim().toLowerCase();
}

function isConjugationPayload(value: unknown): value is ConjugationPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.infinitive !== "string" || !v.infinitive.trim()) return false;
  if (typeof v.translation !== "string") return false;
  if (!Array.isArray(v.tenses) || v.tenses.length === 0) return false;
  return v.tenses.every((t) => {
    if (!t || typeof t !== "object") return false;
    const tense = t as Record<string, unknown>;
    if (typeof tense.name !== "string" || !tense.name.trim()) return false;
    if (!Array.isArray(tense.forms) || tense.forms.length === 0) return false;
    return tense.forms.every((f) => {
      if (!f || typeof f !== "object") return false;
      const form = f as Record<string, unknown>;
      return (
        typeof form.person === "string" &&
        form.person.trim().length > 0 &&
        typeof form.form === "string" &&
        form.form.trim().length > 0
      );
    });
  });
}

async function fetchFromOpenAI(word: string, language: string): Promise<ConjugationPayload | null> {
  const prompt = `You are a linguistic helper. Given a single word (possibly a conjugated verb form) and a language, decide if it is a verb. If yes, return its infinitive plus a compact conjugation table for the most common tenses a learner studies.

Input:
- word: ${word}
- language: ${language}

Rules:
- Output ONLY a JSON object. No prose, no markdown fences.
- If the word is NOT a verb in this language, output: {"isVerb": false}
- If it IS a verb, output: {"isVerb": true, "infinitive": "<dictionary form>", "translation": "<short English gloss, 1-4 words>", "tenses": [<tense objects>]}
- Each tense object has: {"name": "<tense label in the target language, e.g. 'Presente', 'Pretérito', 'Futuro', 'Präsens', 'Perfekt', 'Futur', 'Présent', 'Passé composé', 'Futur', 'Passato prossimo'>", "forms": [{"person": "<pronoun in target language, e.g. 'yo','tú','él/ella','nosotros','vosotros','ellos' or 'ich','du','er/sie','wir','ihr','sie'>", "form": "<conjugated form>"}]}
- Include exactly 3 tenses chosen for the language:
  - Spanish (es/spanish): Presente, Pretérito, Futuro
  - Italian (it/italian): Presente, Passato prossimo, Futuro
  - Portuguese (pt/portuguese): Presente, Pretérito perfeito, Futuro
  - German (de/german): Präsens, Perfekt, Futur I
  - French (fr/french): Présent, Passé composé, Futur simple
  - Other languages: pick three foundational tenses (present, simple past or perfect, simple future).
- Each tense must contain the 6 standard persons used by the language (or 7 if the language splits formal vs informal; keep it to 6 unless essential).
- Compound tenses must include the full conjugated auxiliary + participle (e.g. "he hablado", "ich habe gesprochen").
- The infinitive must be lowercase.`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are a precise linguistic assistant. Output valid JSON only." },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.isVerb === false) return null;

  const candidate: unknown = {
    infinitive: typeof obj.infinitive === "string" ? obj.infinitive.trim().toLowerCase() : "",
    translation: typeof obj.translation === "string" ? obj.translation.trim() : "",
    tenses: Array.isArray(obj.tenses) ? obj.tenses : [],
  };

  if (!isConjugationPayload(candidate)) return null;
  return candidate;
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = (await req.json().catch(() => null)) as Body | null;
  const rawWord = typeof json?.word === "string" ? json.word : "";
  const rawLanguage = typeof json?.language === "string" ? json.language : "";

  const word = normalizeWord(rawWord);
  const language = normalizeLanguage(rawLanguage);

  if (!word || !language) {
    return NextResponse.json({ error: "Missing word or language" }, { status: 400 });
  }
  if (word.length > 80 || language.length > 32) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const directHit = await prisma.verbConjugation.findUnique({
    where: { language_infinitive: { language, infinitive: word } },
    select: { payload: true },
  });
  if (directHit) {
    return NextResponse.json(directHit.payload);
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Conjugations service unavailable" }, { status: 503 });
  }

  let resolved: ConjugationPayload | null = null;
  try {
    resolved = await fetchFromOpenAI(word, language);
  } catch (err) {
    console.error("[conjugations] OpenAI call failed", err);
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }

  if (!resolved) {
    return NextResponse.json({ isVerb: false }, { status: 200 });
  }

  const infinitive = resolved.infinitive;

  const existing = await prisma.verbConjugation.findUnique({
    where: { language_infinitive: { language, infinitive } },
    select: { payload: true },
  });

  if (existing) {
    return NextResponse.json(existing.payload);
  }

  await prisma.verbConjugation.create({
    data: { language, infinitive, payload: resolved as unknown as object },
  });

  return NextResponse.json(resolved);
}
