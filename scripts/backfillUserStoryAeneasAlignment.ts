/**
 * Like `backfillJourneyAeneasAlignment.ts` but for `UserStory` rows.
 * Practice exercises whose `storySlug` points to a user-generated story
 * (Polyglot create-page) need aeneas-aligned segments too; otherwise the
 * mobile clip player matches against drifty Whisper segments and audio
 * cuts into the next sentence.
 *
 * Usage:
 *   npx tsx scripts/backfillUserStoryAeneasAlignment.ts
 *   npx tsx scripts/backfillUserStoryAeneasAlignment.ts --slug eine-reise-durch-berlin
 *   npx tsx scripts/backfillUserStoryAeneasAlignment.ts --force --dry-run
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma";
import { generateAudioSegmentsForUserStory } from "../src/lib/audioWordTimings";

type Args = {
  limit: number | null;
  force: boolean;
  slug: string | null;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { limit: null, force: false, slug: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--force") out.force = true;
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--limit") {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid --limit: ${argv[i + 1]}`);
      out.limit = Math.floor(value);
      i += 1;
    } else if (arg === "--slug") {
      const value = argv[i + 1];
      if (!value) throw new Error("Missing value for --slug");
      out.slug = value;
      i += 1;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  const candidates = await prisma.userStory.findMany({
    where: {
      audioUrl: { not: null },
      ...(args.slug ? { slug: args.slug } : {}),
    },
    select: { id: true, slug: true, title: true, audioSegments: true },
    orderBy: { createdAt: "asc" },
  });

  const stories = args.force
    ? candidates
    : candidates.filter((row) => {
        const segs = row.audioSegments as unknown;
        if (!Array.isArray(segs) || segs.length === 0) return true;
        const first = segs[0] as { id?: unknown };
        return typeof first?.id !== "string" || !first.id.startsWith("sentence-");
      });

  const limited = args.limit ? stories.slice(0, args.limit) : stories;

  console.log(
    `[user-aeneas-backfill] ${limited.length} stories to process${args.force ? " (force)" : ""}${args.dryRun ? " [dry-run]" : ""}` +
      (stories.length !== candidates.length
        ? ` (${candidates.length - stories.length} already aeneas-aligned, skipped)`
        : "")
  );

  let ok = 0;
  let failed = 0;
  for (const story of limited) {
    const tag = `${story.slug ?? story.id} (${story.title ?? "untitled"})`;
    if (args.dryRun) {
      console.log(`  - would align ${tag}`);
      continue;
    }
    try {
      const result = await generateAudioSegmentsForUserStory(story.id);
      console.log(`  ok ${tag} -> ${result.segmentCount} segments, dur=${result.audioDurationSec ?? "?"}s`);
      ok += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  fail ${tag}: ${msg}`);
      failed += 1;
    }
  }

  console.log(`[user-aeneas-backfill] done. ok=${ok} failed=${failed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[user-aeneas-backfill] fatal:", err);
  process.exit(1);
});
