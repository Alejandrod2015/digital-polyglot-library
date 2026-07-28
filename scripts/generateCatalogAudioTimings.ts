/**
 * Generate aeneas word-level alignments for every story in the static
 * catalog (`src/data/books/*.ts`) and persist them to
 * `CatalogStoryAudioTimings`. Same payload shape as
 * `JourneyStory.audioWordTimings`, so the mobile reader picks them up
 * via the existing `/api/mobile/audio-word-timings` endpoint and runs
 * the real karaoke (no more linear estimate heuristic).
 *
 * Usage:
 *   pnpm tsx scripts/generateCatalogAudioTimings.ts
 *   pnpm tsx scripts/generateCatalogAudioTimings.ts --slug alebrijes-criaturas-fantasticas-del-imaginario-mexicano
 *   pnpm tsx scripts/generateCatalogAudioTimings.ts --limit 5
 *   pnpm tsx scripts/generateCatalogAudioTimings.ts --force
 *
 * Flags:
 *   --slug X      Only process this slug.
 *   --limit N     Process at most N stories.
 *   --force       Re-align even if a row already exists.
 *   --dry-run     Print what would happen without calling Modal or DB.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma";
import { books } from "../src/data/books";
// Import the alignment directly: the `audioWordTimings` barrel sits next to
// lib/prisma, whose `server-only` guard aborts the process under tsx.
import { alignStoryAudio } from "../src/lib/alignStoryAudio";

type Args = {
  slug: string | null;
  limit: number | null;
  force: boolean;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { slug: null, limit: null, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--force") out.force = true;
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--slug") {
      out.slug = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === "--limit") {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid --limit: ${argv[i + 1]}`);
      out.limit = Math.floor(value);
      i += 1;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  // The catalog lives in the DB (`CatalogStory`), not in the static dump:
  // src/data/books only carries the 4 books that came from the Sanity dump,
  // which is why 59 published catalog stories never got timings. Read the DB
  // and keep the static dump only as a fallback for rows not migrated yet.
  const candidates: Array<{
    slug: string;
    title: string;
    text: string;
    audioUrl: string;
    language: string;
  }> = [];
  const seen = new Set<string>();

  const dbRows = await prisma.catalogStory.findMany({
    where: {
      ...(args.slug ? { slug: args.slug } : {}),
      book: { published: true },
    },
    select: {
      slug: true,
      title: true,
      text: true,
      audio: true,
      audioUrl: true,
      language: true,
      book: { select: { language: true } },
    },
    orderBy: [{ bookId: "asc" }, { position: "asc" }],
  });
  for (const row of dbRows) {
    const audio = row.audioUrl || row.audio;
    if (!audio || !row.text || !row.slug) continue;
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    candidates.push({
      slug: row.slug,
      title: row.title ?? "",
      text: row.text,
      audioUrl: audio,
      language: row.language ?? row.book?.language ?? "spanish",
    });
  }

  for (const book of Object.values(books)) {
    for (const story of book.stories) {
      if (!story.audio || !story.text) continue;
      if (!story.slug || seen.has(story.slug)) continue;
      if (args.slug && story.slug !== args.slug) continue;
      seen.add(story.slug);
      candidates.push({
        slug: story.slug,
        title: story.title ?? "",
        text: story.text,
        audioUrl: story.audio,
        language: (story.language ?? book.language ?? "spanish") as string,
      });
    }
  }

  if (candidates.length === 0) {
    console.log("No catalog stories to align.");
    return;
  }

  // Filter out already-aligned slugs unless --force is set.
  let toProcess = candidates;
  if (!args.force) {
    const existing = await prisma.catalogStoryAudioTimings.findMany({
      where: { slug: { in: candidates.map((c) => c.slug) } },
      select: { slug: true },
    });
    const existingSet = new Set(existing.map((row) => row.slug));
    toProcess = candidates.filter((c) => !existingSet.has(c.slug));
  }

  if (args.limit !== null) {
    toProcess = toProcess.slice(0, args.limit);
  }

  console.log(
    `Catalog stories: ${candidates.length} total, ${toProcess.length} to align${
      args.dryRun ? " (dry-run)" : ""
    }`
  );

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < toProcess.length; i += 1) {
    const story = toProcess[i];
    const label = `[${i + 1}/${toProcess.length}] ${story.slug}`;
    if (args.dryRun) {
      console.log(`${label} DRY-RUN`);
      continue;
    }

    try {
      const t0 = Date.now();
      // alignStoryAudio handles everything: extractStoryPlainText,
      // stripSpeakerLabels (so aeneas doesn't drift on "Tomás:" cues
      // the narrator never reads), buildAlignmentText for the title
      // prefix, the Modal call, and remapping tokens back to the
      // original-with-labels text space.
      const { payload } = await alignStoryAudio({
        text: story.text,
        title: story.title,
        audioUrl: story.audioUrl,
        language: story.language,
        storyId: story.slug,
      });

      // The word timings are stored exactly as aeneas returns them. This
      // script used to run `correctAlignmentDrift` on top of the payload --
      // which alignStoryAudio was ALSO applying internally, so the 80 rows
      // written on 2026-05-11 carry that shift twice. Measured 2026-07-27:
      // the correction is what made the highlight lag (see the note in
      // src/lib/audioWordTimings.ts). Rows written before that date should be
      // regenerated with this script rather than trusted.
      await prisma.catalogStoryAudioTimings.upsert({
        where: { slug: story.slug },
        create: {
          slug: story.slug,
          audioWordTimings: payload as unknown as object,
          audioDurationSec: payload.audioDurationSec,
        },
        update: {
          audioWordTimings: payload as unknown as object,
          audioDurationSec: payload.audioDurationSec,
        },
      });

      const elapsed = Math.round((Date.now() - t0) / 1000);
      console.log(`${label} OK (${payload.words.length} tokens, ${elapsed}s)`);
      ok += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${label} FAIL: ${message}`);
      fail += 1;
    }
  }

  console.log(`\nDone. ok=${ok} fail=${fail} total=${toProcess.length}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
