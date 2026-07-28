/**
 * Which words can the reader NEVER highlight?
 *
 * Replays `findActiveWordIndex` (the exact lookup in
 * HighlightedStoryReader) across the whole audio at 10 ms resolution and
 * collects every index it ever returns. Anything missing from that set is a
 * word the highlight provably skips, no matter how the user plays the story.
 * Read-only.
 *
 *   npx tsx scripts/_karaokeSkipCheck.ts [--limit 60] [--verbose slug]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import {
  coerceAudioWordTimings,
  type StoryWordToken,
} from "../src/lib/audioWordTimingsTypes";
// The SAME code the reader runs, so the simulation cannot drift from it.
import { buildWordWindows, findActiveWordIndex } from "../src/lib/karaokeWordWindows";

const prisma = new PrismaClient();

/** The lookup as it was BEFORE the fix, kept to measure the difference. */
function findActiveWordIndexLegacy(words: StoryWordToken[], currentTime: number): number | null {
  let last: number | null = null;
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (w.startSec === null) continue;
    if (currentTime < w.startSec) break;
    let nextStart: number | null = null;
    for (let j = i + 1; j < words.length; j += 1) {
      const candidate = words[j].startSec;
      if (candidate !== null && candidate > w.startSec) {
        nextStart = candidate;
        break;
      }
    }
    if (nextStart === null || currentTime < nextStart) return i;
    last = i;
  }
  return last;
}

function analyse(words: StoryWordToken[], durationSec: number, legacy: boolean) {
  const windows = buildWordWindows(words, durationSec);
  const reachable = new Set<number>();
  for (let t = 0; t <= durationSec + 0.5; t += 0.005) {
    const idx = legacy
      ? findActiveWordIndexLegacy(words, t)
      : findActiveWordIndex(windows, t);
    if (idx !== null) reachable.add(idx);
  }
  const skipped: number[] = [];
  for (let i = 0; i < words.length; i += 1) if (!reachable.has(i)) skipped.push(i);

  let nulls = 0;
  let ties = 0;
  let nonMonotonic = 0;
  let prev: number | null = null;
  for (const w of words) {
    if (w.startSec === null) {
      nulls += 1;
      continue;
    }
    if (prev !== null) {
      if (w.startSec === prev) ties += 1;
      else if (w.startSec < prev) nonMonotonic += 1;
    }
    prev = w.startSec;
  }
  return { skipped, nulls, ties, nonMonotonic };
}

async function main() {
  const argv = process.argv.slice(2);
  const at = (f: string) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const limit = parseInt(at("--limit") ?? "60", 10);
  const verbose = at("--verbose");

  const rows = await prisma.journeyStory.findMany({
    where: { audioWordTimings: { not: null }, audioUrl: { not: null } },
    select: { slug: true, audioWordTimings: true },
    orderBy: { updatedAt: "desc" },
    take: verbose ? 500 : limit,
  });

  let totalWords = 0;
  let totalSkipped = 0;
  let totalNulls = 0;
  let totalTies = 0;
  let totalNonMono = 0;
  let storiesAffected = 0;
  const worst: Array<{ slug: string; pct: number; skipped: number; words: number }> = [];

  for (const row of rows) {
    const payload = coerceAudioWordTimings(row.audioWordTimings);
    if (!payload) continue;
    const dur = payload.audioDurationSec ?? 0;
    if (dur <= 0) continue;
    const r = analyse(payload.words, dur, argv.includes("--legacy"));
    totalWords += payload.words.length;
    totalSkipped += r.skipped.length;
    totalNulls += r.nulls;
    totalTies += r.ties;
    totalNonMono += r.nonMonotonic;
    if (r.skipped.length > 0) storiesAffected += 1;
    worst.push({
      slug: row.slug ?? "?",
      pct: (100 * r.skipped.length) / payload.words.length,
      skipped: r.skipped.length,
      words: payload.words.length,
    });

    if (verbose && row.slug === verbose) {
      console.log(`\n${row.slug}: ${r.skipped.length}/${payload.words.length} palabras nunca se encienden`);
      for (const i of r.skipped.slice(0, 25)) {
        const w = payload.words[i];
        const p = payload.words[i - 1];
        console.log(
          `  [${i}] "${w.text}" start=${w.startSec} (anterior "${p?.text}" start=${p?.startSec})`
        );
      }
    }
  }

  worst.sort((a, b) => b.pct - a.pct);
  console.log(`historias analizadas: ${worst.length} (${storiesAffected} con palabras saltadas)`);
  console.log(`palabras: ${totalWords} | nunca resaltadas: ${totalSkipped} (${((100 * totalSkipped) / totalWords).toFixed(1)}%)`);
  console.log(`causas en los datos: startSec null=${totalNulls} | empates=${totalTies} | fuera de orden=${totalNonMono}`);
  console.log("\npeores historias:");
  for (const w of worst.slice(0, 10)) {
    console.log(`  ${w.slug.padEnd(34)} ${w.skipped}/${w.words} (${w.pct.toFixed(1)}%)`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
