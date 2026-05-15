/**
 * Backfill: rewrite long vocab definitions in JourneyStory.vocab so they
 * respect the new UI hard-limit (3-7 words AND ≤50 chars per def).
 *
 * Reason: el truncado con `…` en el cliente quedaba feo. La regla de
 * verdad es el límite de chars en GENERACIÓN; este script alinea las
 * historias ya existentes que se generaron con el prompt viejo (8-18
 * palabras).
 *
 * Uso:
 *   # Dry-run: solo cuenta cuántos defs hay que reescribir.
 *   npx tsx scripts/shortenJourneyDefinitions.ts --dry
 *
 *   # Aplicar: reescribe con OpenAI y guarda al DB.
 *   npx tsx scripts/shortenJourneyDefinitions.ts --apply
 *
 *   # Filtrar por storyId o por slug (opcional).
 *   npx tsx scripts/shortenJourneyDefinitions.ts --apply --story-id=cuid...
 *   npx tsx scripts/shortenJourneyDefinitions.ts --apply --slug=cafe-in-kreuzberg
 */

import { config } from "dotenv";
import OpenAI from "openai";
import { PrismaClient } from "../src/generated/prisma";
import {
  DEFINITION_MAX_CHARS,
  DEFINITION_MAX_WORDS,
  DEFINITION_MIN_WORDS,
  wordCount,
} from "../src/lib/vocabValidation";

config({ path: ".env.local" });
config({ path: ".env" });

const prisma = new PrismaClient();
const openai = new OpenAI();

const APPLY = process.argv.includes("--apply");
const DRY = process.argv.includes("--dry") || !APPLY;
const STORY_ID = process.argv.find((a) => a.startsWith("--story-id="))?.split("=")[1];
const SLUG = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];

type VocabItem = {
  word: string;
  surface?: string;
  definition: string;
  type?: string;
};

function definitionViolatesLimit(definition: string): boolean {
  const trimmed = definition.trim();
  if (!trimmed) return false;
  if (trimmed.length > DEFINITION_MAX_CHARS) return true;
  const wc = wordCount(trimmed);
  return wc > DEFINITION_MAX_WORDS;
}

async function shortenBatch(
  language: string,
  offenders: VocabItem[]
): Promise<Record<string, string>> {
  // word → new definition
  const prompt = `
You shorten English vocabulary definitions to fit a mobile UI chip.

HARD LIMIT for every output definition:
- ${DEFINITION_MIN_WORDS}-${DEFINITION_MAX_WORDS} English words AND
- ≤${DEFINITION_MAX_CHARS} characters total (counting spaces).

Both bounds are MANDATORY. The chip cannot wrap; defs longer than ${DEFINITION_MAX_CHARS} chars will be rejected and re-asked.

Style: concise gloss in the spirit of a translation app (Linguee/Reverso/DeepL). Lead with the concept, an infinitive ("To stir..."), or a descriptive adjective phrase. Two senses joined by ";" or "," are fine if they stay under the limit.

Never use em-dashes; use semicolons, colons, commas, or parentheses.
Never return a bare one-word translation; add at least one clarifying word.
Keep the same meaning as the original definition; just compress.

Source language of the words: ${language}.
Output language of the definitions: English.

Input is a JSON array of items: { "word": string, "definition": string }.
Return ONLY a JSON array of the same length with the shortened "definition" for each "word". Keep the "word" field exactly as input.
`.trim();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You shorten vocabulary definitions. Output strictly valid JSON in the shape { \"items\": [{ \"word\": string, \"definition\": string }] } with each definition respecting the hard limit.",
      },
      {
        role: "user",
        content: `${prompt}\n\nInput:\n${JSON.stringify(
          offenders.map((o) => ({ word: o.word, definition: o.definition }))
        )}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim() ?? "";
  let parsed: { items?: Array<{ word: string; definition: string }> };
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.warn("[shorten] failed to parse model output", content.slice(0, 200));
    return {};
  }
  const out: Record<string, string> = {};
  for (const it of parsed.items ?? []) {
    if (it && typeof it.word === "string" && typeof it.definition === "string") {
      out[it.word] = it.definition.trim();
    }
  }
  return out;
}

async function run() {
  console.log(`[shorten] mode=${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(
    `[shorten] limit: ${DEFINITION_MIN_WORDS}-${DEFINITION_MAX_WORDS} words, ≤${DEFINITION_MAX_CHARS} chars.`
  );

  const stories = await prisma.journeyStory.findMany({
    where: {
      vocab: { not: null },
      ...(STORY_ID ? { id: STORY_ID } : {}),
      ...(SLUG ? { slug: SLUG } : {}),
    },
    select: { id: true, slug: true, title: true, vocab: true, journey: { select: { language: true } } },
  });

  console.log(`[shorten] scanning ${stories.length} journey stories...`);

  let totalScanned = 0;
  let totalViolating = 0;
  let totalRewritten = 0;
  let storiesTouched = 0;

  for (const story of stories) {
    const vocab = Array.isArray(story.vocab) ? (story.vocab as VocabItem[]) : [];
    if (vocab.length === 0) continue;
    totalScanned += vocab.length;

    const offenders = vocab.filter((v) => definitionViolatesLimit(v.definition));
    if (offenders.length === 0) continue;

    totalViolating += offenders.length;
    storiesTouched += 1;
    console.log(
      `\n[shorten] ${story.slug ?? story.id} (${story.title ?? "untitled"}) — ${offenders.length}/${vocab.length} long defs`
    );
    for (const o of offenders.slice(0, 3)) {
      console.log(`           · ${o.word}: "${o.definition.slice(0, 80)}${o.definition.length > 80 ? "..." : ""}" (${o.definition.length} chars, ${wordCount(o.definition)} words)`);
    }
    if (offenders.length > 3) console.log(`           · ...and ${offenders.length - 3} more`);

    if (DRY) continue;

    // Rewrite in chunks of 10 to keep prompts compact.
    const chunked: VocabItem[][] = [];
    for (let i = 0; i < offenders.length; i += 10) {
      chunked.push(offenders.slice(i, i + 10));
    }
    const mapping: Record<string, string> = {};
    for (const batch of chunked) {
      const result = await shortenBatch(story.journey?.language ?? "german", batch);
      Object.assign(mapping, result);
    }

    // Apply only definitions that came back within limit. Anything
    // that came back still too long → log and retry once with a
    // stricter reminder.
    const stillLong: VocabItem[] = [];
    for (const o of offenders) {
      const next = mapping[o.word];
      if (!next || definitionViolatesLimit(next)) {
        stillLong.push(o);
      }
    }
    if (stillLong.length > 0) {
      const retry = await shortenBatch(story.journey?.language ?? "german", stillLong);
      Object.assign(mapping, retry);
    }

    const updatedVocab: VocabItem[] = vocab.map((v) => {
      const next = mapping[v.word];
      if (next && !definitionViolatesLimit(next)) {
        totalRewritten += 1;
        return { ...v, definition: next };
      }
      return v;
    });

    await prisma.journeyStory.update({
      where: { id: story.id },
      data: { vocab: updatedVocab },
    });
    console.log(`           ✓ saved.`);
  }

  console.log("\n[shorten] done.");
  console.log(`   scanned defs: ${totalScanned}`);
  console.log(`   over the limit: ${totalViolating}`);
  if (!DRY) console.log(`   rewritten + saved: ${totalRewritten}`);
  console.log(`   stories touched: ${storiesTouched}`);
}

run()
  .catch((err) => {
    console.error("[shorten] fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
