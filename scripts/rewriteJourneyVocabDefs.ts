/**
 * Rewrite bad vocabulary definitions in published JourneyStory rows.
 *
 * Workflow (no external LLM is called from this script — Claude Code does the
 * rewriting in-conversation):
 *
 *   1) `--export` reads the DB, classifies every vocab definition against the
 *      validators in src/lib/vocabQuality.ts, and writes:
 *        data/vocab-rewrites/input.json   bad defs grouped by story + context
 *        data/vocab-rewrites/backup.json  full original vocab arrays per story
 *
 *   2) Claude rewrites each bad def by hand in the conversation and writes:
 *        data/vocab-rewrites/output.json  { rewrites: [{storyId, word, newDefinition}] }
 *
 *   3) `--apply` reads output.json, validates each new def against the same
 *      rules, and only then updates the DB. Failed defs keep their original.
 */

import { config } from "dotenv";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";

config({ path: ".env.local" });
config({ path: ".env" });

type VocabItem = {
  word: string;
  surface?: string;
  definition: string;
  type?: string;
};

const MULETILLA_OPENERS: RegExp[] = [
  /^refers\s+to\b/i,
  /^describes?\b/i,
  /^used\s+(to|for|in|as|when)\b/i,
  /^means?\b/i,
  /^meaning\b/i,
  /^conveys?\b/i,
  /^speaks?\s+to\b/i,
  /^brings?\b/i,
  /^this\s+word\b/i,
  /^a\s+type\s+of\b/i,
  /^a\s+person\s+who\b/i,
  /^someone\s+who\b/i,
  /^something\s+that\b/i,
  /^the\s+(action|state|quality)\s+of\b/i,
];

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasMuletillaOpener(def: string): boolean {
  return MULETILLA_OPENERS.some((re) => re.test(def.trim()));
}

const LEADING_GLOSS_PATTERNS: RegExp[] = [
  /^[A-Za-z][A-Za-z'\-]*[;,:]/,
  /^[A-Za-z][A-Za-z'\-]*\s*\([^)]*\)\s*[;,:]/,
  /^(A|An|The|To)\s+[A-Za-z'\-]+[;,:]/i,
  /^(A|An|The|To)\s+[A-Za-z'\-]+\s*\([^)]*\)\s*[;,:]/i,
];

function hasLeadingOneWordGloss(def: string): boolean {
  const t = def.trim();
  return LEADING_GLOSS_PATTERNS.some((re) => re.test(t));
}

function hasEmDash(def: string): boolean {
  return /—/.test(def);
}

type Reason = "muletilla" | "leading-gloss" | "em-dash" | "too-long" | "too-short";

function classify(def: string): Reason[] {
  const reasons: Reason[] = [];
  if (hasMuletillaOpener(def)) reasons.push("muletilla");
  if (hasLeadingOneWordGloss(def)) reasons.push("leading-gloss");
  if (hasEmDash(def)) reasons.push("em-dash");
  const wc = wordCount(def);
  if (wc > 16) reasons.push("too-long");
  if (wc < 6) reasons.push("too-short");
  return reasons;
}

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "vocab-rewrites");
const INPUT_FILE = path.join(DATA_DIR, "input.json");
const BACKUP_FILE = path.join(DATA_DIR, "backup.json");
const OUTPUT_FILE = path.join(DATA_DIR, "output.json");

async function exportPhase(prisma: PrismaClient) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const stories = await prisma.journeyStory.findMany({
    where: { status: "published" },
    include: { journey: { select: { language: true, variant: true } } },
    orderBy: { createdAt: "asc" },
  });

  type ExportEntry = {
    storyId: string;
    slug: string | null;
    language: string;
    variant: string;
    level: string;
    topic: string;
    storyTitle: string | null;
    storyExcerpt: string;
    badDefs: {
      index: number;
      word: string;
      surface?: string;
      type?: string;
      originalDefinition: string;
      reasons: Reason[];
      wordCount: number;
    }[];
  };

  const entries: ExportEntry[] = [];
  const backup: Record<string, VocabItem[]> = {};
  let totalDefs = 0;
  let totalBad = 0;

  for (const story of stories) {
    if (!Array.isArray(story.vocab) || !story.text) continue;
    const vocab = story.vocab as unknown as VocabItem[];
    totalDefs += vocab.length;

    const badDefs: ExportEntry["badDefs"] = [];
    for (let i = 0; i < vocab.length; i += 1) {
      const def = vocab[i]?.definition ?? "";
      const reasons = classify(def);
      if (reasons.length === 0) continue;
      const v = vocab[i];
      badDefs.push({
        index: i,
        word: v.word,
        ...(v.surface ? { surface: v.surface } : {}),
        ...(v.type ? { type: v.type } : {}),
        originalDefinition: v.definition,
        reasons,
        wordCount: wordCount(v.definition),
      });
      totalBad += 1;
    }

    if (badDefs.length === 0) continue;
    backup[story.id] = vocab;
    entries.push({
      storyId: story.id,
      slug: story.slug,
      language: story.journey.language,
      variant: story.journey.variant,
      level: story.level,
      topic: story.topic,
      storyTitle: story.title,
      storyExcerpt: story.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500),
      badDefs,
    });
  }

  writeFileSync(INPUT_FILE, JSON.stringify({ exportedAt: new Date().toISOString(), totalStories: entries.length, totalBadDefs: totalBad, totalDefs, stories: entries }, null, 2));
  writeFileSync(BACKUP_FILE, JSON.stringify({ exportedAt: new Date().toISOString(), vocab: backup }, null, 2));

  console.log(`Exported ${entries.length} stories with ${totalBad} bad defs (out of ${totalDefs} total).`);
  console.log(`  input:  ${INPUT_FILE}`);
  console.log(`  backup: ${BACKUP_FILE}`);
}

async function applyPhase(prisma: PrismaClient) {
  if (!existsSync(OUTPUT_FILE)) {
    throw new Error(`Output file not found: ${OUTPUT_FILE}. Run --export first and produce rewrites.`);
  }
  if (!existsSync(BACKUP_FILE)) {
    throw new Error(`Backup file not found: ${BACKUP_FILE}. Aborting.`);
  }
  if (!existsSync(INPUT_FILE)) {
    throw new Error(`Input file not found: ${INPUT_FILE}.`);
  }

  type Rewrite = { storyId: string; word: string; newDefinition: string };
  const output = JSON.parse(readFileSync(OUTPUT_FILE, "utf8")) as { rewrites: Rewrite[] };
  const backup = JSON.parse(readFileSync(BACKUP_FILE, "utf8")) as { vocab: Record<string, VocabItem[]> };
  const input = JSON.parse(readFileSync(INPUT_FILE, "utf8")) as {
    stories: { storyId: string; badDefs: { word: string; index: number }[] }[];
  };

  const rewriteMap = new Map<string, string>();
  for (const r of output.rewrites) {
    rewriteMap.set(`${r.storyId}::${r.word.toLowerCase()}`, r.newDefinition);
  }

  let storiesUpdated = 0;
  let defsRewritten = 0;
  let defsRejected = 0;
  let defsMissing = 0;

  for (const entry of input.stories) {
    const original = backup.vocab[entry.storyId];
    if (!original) {
      console.warn(`No backup for story ${entry.storyId}; skipping`);
      continue;
    }
    const updated = original.map((item) => ({ ...item }));
    let touched = false;

    for (const bad of entry.badDefs) {
      const key = `${entry.storyId}::${bad.word.toLowerCase()}`;
      const newDef = rewriteMap.get(key);
      if (!newDef) {
        defsMissing += 1;
        continue;
      }
      const reasons = classify(newDef);
      if (reasons.length > 0) {
        console.warn(`  rejected (${reasons.join(",")}, ${wordCount(newDef)}w): ${entry.storyId} ${bad.word} → ${newDef}`);
        defsRejected += 1;
        continue;
      }
      updated[bad.index] = { ...updated[bad.index], definition: newDef };
      defsRewritten += 1;
      touched = true;
    }

    if (!touched) continue;
    await prisma.journeyStory.update({
      where: { id: entry.storyId },
      data: { vocab: updated as any, vocabCount: updated.length },
    });
    storiesUpdated += 1;
  }

  console.log("\n=== Apply summary ===");
  console.log(`Stories updated: ${storiesUpdated}`);
  console.log(`Defs rewritten: ${defsRewritten}`);
  console.log(`Defs rejected (failed validation): ${defsRejected}`);
  console.log(`Defs missing in output.json: ${defsMissing}`);
}

async function run() {
  const mode = process.argv.includes("--export")
    ? "export"
    : process.argv.includes("--apply")
      ? "apply"
      : null;
  if (!mode) {
    console.error("Pass --export or --apply.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    if (mode === "export") await exportPhase(prisma);
    else await applyPhase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
