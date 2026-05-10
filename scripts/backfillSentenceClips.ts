/**
 * Pre-cut every sentence of every aeneas-aligned story into its own mp3
 * file in R2 and persist the URL into `audioSegments[i].clipUrl`. The
 * mobile practice player already prefers `clipUrl` over positionMillis
 * seeking, so this removes the last source of drift in clip playback.
 *
 * Touches both `JourneyStory.audioSegments` and `UserStory.audioSegments`.
 *
 * Usage:
 *   npx tsx scripts/backfillSentenceClips.ts
 *   npx tsx scripts/backfillSentenceClips.ts --slug cafe-in-kreuzberg
 *   npx tsx scripts/backfillSentenceClips.ts --dry-run
 *   npx tsx scripts/backfillSentenceClips.ts --force
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma";
import { coerceAudioSegments, type AudioSegment } from "../src/lib/audioSegments";
import { cutSegmentClipsForStory } from "../src/lib/sentenceClipCutter";

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

type Row = {
  id: string;
  slug: string | null;
  title: string | null;
  audioUrl: string | null;
  audioSegments: unknown;
  source: "journey" | "user";
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  const journey = (await prisma.journeyStory.findMany({
    where: {
      audioUrl: { not: null },
      ...(args.slug ? { slug: args.slug } : {}),
    },
    select: { id: true, slug: true, title: true, audioUrl: true, audioSegments: true },
  })).map((r) => ({ ...r, source: "journey" as const }));
  const user = (await prisma.userStory.findMany({
    where: {
      audioUrl: { not: null },
      ...(args.slug ? { slug: args.slug } : {}),
    },
    select: { id: true, slug: true, title: true, audioUrl: true, audioSegments: true },
  })).map((r) => ({ ...r, source: "user" as const }));

  const all: Row[] = [...journey, ...user];

  // Only stories whose segments are aeneas-derived (id `sentence-N`).
  // Whisper segments are too drifty to be worth pre-cutting.
  const eligible = all.filter((row) => {
    const segs = coerceAudioSegments(row.audioSegments);
    return segs.length > 0 && segs[0].id.startsWith("sentence-");
  });

  // Skip stories whose every segment already has a clipUrl, unless --force.
  const stories = args.force
    ? eligible
    : eligible.filter((row) => {
        const segs = coerceAudioSegments(row.audioSegments);
        return segs.some((s) => !s.clipUrl);
      });

  const limited = args.limit ? stories.slice(0, args.limit) : stories;

  console.log(
    `[clips-backfill] ${limited.length} stories to cut${args.force ? " (force)" : ""}${args.dryRun ? " [dry-run]" : ""}` +
      (eligible.length !== stories.length
        ? ` (${eligible.length - stories.length} already have clipUrl on every segment, skipped)`
        : "") +
      ` (skipped non-aeneas: ${all.length - eligible.length})`
  );

  let okStories = 0;
  let failedStories = 0;
  let totalCuts = 0;
  let totalSkipped = 0;
  for (const row of limited) {
    const segs = coerceAudioSegments(row.audioSegments);
    const tag = `${row.slug ?? row.id} (${row.source}, ${segs.length} segs)`;
    if (args.dryRun) {
      console.log(`  - would cut ${tag}`);
      continue;
    }
    try {
      const result = await cutSegmentClipsForStory({
        storyId: row.id,
        audioUrl: row.audioUrl!,
        segments: segs,
        force: args.force,
      });
      const updatedJson = result.segments as unknown as object;
      if (row.source === "journey") {
        await prisma.journeyStory.update({ where: { id: row.id }, data: { audioSegments: updatedJson } });
      } else {
        await prisma.userStory.update({ where: { id: row.id }, data: { audioSegments: updatedJson } });
      }
      console.log(`  ok ${tag} -> cuts=${result.cuts.length} reused=${result.skipped} failed=${result.failed}`);
      okStories += 1;
      totalCuts += result.cuts.length;
      totalSkipped += result.skipped;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  fail ${tag}: ${msg}`);
      failedStories += 1;
    }
  }

  console.log(`[clips-backfill] done. stories ok=${okStories} failed=${failedStories} | clips cut=${totalCuts} reused=${totalSkipped}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[clips-backfill] fatal:", err);
  process.exit(1);
});

// keep AudioSegment in the import surface for future readers
export type _SegmentRef = AudioSegment;
