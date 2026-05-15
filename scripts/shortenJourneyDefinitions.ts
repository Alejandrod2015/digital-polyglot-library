/**
 * Backfill: rewrite long vocab definitions in JourneyStory.vocab so they
 * respect the UI hard-limit (3-7 words AND ≤50 chars per def).
 *
 * Tres modos, encadenables sin OpenAI:
 *
 *   1. `--dump`: lee todas las stories, identifica defs largas y las
 *      vuelca a `data/vocab-shorten/input.json` (no toca DB).
 *      ```
 *      npx tsx scripts/shortenJourneyDefinitions.ts --dump
 *      ```
 *
 *   2. Claude (yo, en chat) genera `data/vocab-shorten/output.json` con la
 *      misma shape pero la nueva `definition` corta. Hace falta UNA
 *      operación manual por mi parte — no requiere LLM API.
 *
 *   3. `--apply-rewrites`: lee `output.json` y persiste cada nueva
 *      definición al campo `JourneyStory.vocab`.
 *      ```
 *      npx tsx scripts/shortenJourneyDefinitions.ts --apply-rewrites
 *      ```
 *
 * Bonus: `--dry` mantiene el comportamiento viejo de listar violadores
 * (no escribe archivo). Útil para sanity check antes de --dump.
 */

import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
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

const MODE_DUMP = process.argv.includes("--dump");
const MODE_APPLY = process.argv.includes("--apply-rewrites");
const MODE_DRY = process.argv.includes("--dry") || (!MODE_DUMP && !MODE_APPLY);
const STORY_ID = process.argv.find((a) => a.startsWith("--story-id="))?.split("=")[1];
const SLUG = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "data", "vocab-shorten");
const INPUT_PATH = path.join(DIR, "input.json");
const OUTPUT_PATH = path.join(DIR, "output.json");

type VocabItem = {
  word: string;
  surface?: string;
  definition: string;
  type?: string;
};

type DumpStory = {
  storyId: string;
  slug: string | null;
  title: string | null;
  language: string | null;
  longDefs: Array<{ word: string; definition: string; chars: number; words: number }>;
};

function definitionViolatesLimit(definition: string): boolean {
  const trimmed = definition.trim();
  if (!trimmed) return false;
  if (trimmed.length > DEFINITION_MAX_CHARS) return true;
  const wc = wordCount(trimmed);
  return wc > DEFINITION_MAX_WORDS;
}

async function runScan(write: boolean) {
  const stories = await prisma.journeyStory.findMany({
    where: {
      vocab: { not: null },
      ...(STORY_ID ? { id: STORY_ID } : {}),
      ...(SLUG ? { slug: SLUG } : {}),
    },
    select: { id: true, slug: true, title: true, vocab: true, journey: { select: { language: true } } },
  });

  let totalScanned = 0;
  let totalViolating = 0;
  let storiesTouched = 0;
  const dump: DumpStory[] = [];

  for (const story of stories) {
    const vocab = Array.isArray(story.vocab) ? (story.vocab as VocabItem[]) : [];
    if (vocab.length === 0) continue;
    totalScanned += vocab.length;
    const offenders = vocab.filter((v) => definitionViolatesLimit(v.definition));
    if (offenders.length === 0) continue;
    totalViolating += offenders.length;
    storiesTouched += 1;
    dump.push({
      storyId: story.id,
      slug: story.slug ?? null,
      title: story.title ?? null,
      language: story.journey?.language ?? null,
      longDefs: offenders.map((o) => ({
        word: o.word,
        definition: o.definition,
        chars: o.definition.length,
        words: wordCount(o.definition),
      })),
    });
  }

  console.log(`[shorten] scan complete`);
  console.log(`   scanned defs: ${totalScanned}`);
  console.log(`   over the limit: ${totalViolating}`);
  console.log(`   stories touched: ${storiesTouched}`);
  console.log(`   limit: ${DEFINITION_MIN_WORDS}-${DEFINITION_MAX_WORDS} words, ≤${DEFINITION_MAX_CHARS} chars`);

  if (write) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(INPUT_PATH, JSON.stringify(dump, null, 2));
    console.log(`\n[shorten] wrote ${dump.length} stories → ${INPUT_PATH}`);
    console.log(`[shorten] next step: have Claude write rewrites to ${OUTPUT_PATH} with the same shape.`);
  }
}

async function runApply() {
  let raw: string;
  try {
    raw = readFileSync(OUTPUT_PATH, "utf8");
  } catch (err) {
    console.error(`[shorten] cannot read ${OUTPUT_PATH}. Run --dump first then have Claude generate it.`);
    process.exit(1);
  }
  const rewrites = JSON.parse(raw) as DumpStory[];
  console.log(`[shorten] applying rewrites for ${rewrites.length} stories...`);

  let storiesUpdated = 0;
  let defsUpdated = 0;
  let defsRejected = 0;

  for (const rewrite of rewrites) {
    const story = await prisma.journeyStory.findUnique({
      where: { id: rewrite.storyId },
      select: { id: true, slug: true, vocab: true },
    });
    if (!story) {
      console.warn(`[shorten] story ${rewrite.storyId} not found, skipping`);
      continue;
    }
    const vocab = Array.isArray(story.vocab) ? (story.vocab as VocabItem[]) : [];
    if (vocab.length === 0) continue;

    const byWord = new Map(rewrite.longDefs.map((d) => [d.word, d.definition]));
    let touched = 0;
    const updatedVocab: VocabItem[] = vocab.map((v) => {
      const next = byWord.get(v.word);
      if (!next) return v;
      if (definitionViolatesLimit(next)) {
        defsRejected += 1;
        console.warn(`   · ${rewrite.slug ?? rewrite.storyId} / ${v.word}: rewrite still too long ("${next}" — ${next.length} chars, ${wordCount(next)} words), keeping original`);
        return v;
      }
      touched += 1;
      defsUpdated += 1;
      return { ...v, definition: next };
    });

    if (touched > 0) {
      await prisma.journeyStory.update({
        where: { id: story.id },
        data: { vocab: updatedVocab },
      });
      storiesUpdated += 1;
      console.log(`[shorten] ✓ ${rewrite.slug ?? rewrite.storyId}: ${touched} defs updated`);
    }
  }

  console.log(`\n[shorten] done.`);
  console.log(`   stories updated: ${storiesUpdated}`);
  console.log(`   defs updated:    ${defsUpdated}`);
  console.log(`   defs rejected:   ${defsRejected}`);
}

async function run() {
  if (MODE_APPLY) {
    console.log(`[shorten] mode=APPLY-REWRITES`);
    await runApply();
    return;
  }
  if (MODE_DUMP) {
    console.log(`[shorten] mode=DUMP`);
    await runScan(true);
    return;
  }
  console.log(`[shorten] mode=DRY-SCAN`);
  await runScan(false);
}

run()
  .catch((err) => {
    console.error("[shorten] fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
