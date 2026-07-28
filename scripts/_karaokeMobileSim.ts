/**
 * Does the MOBILE reader skip words too?
 *
 * The app has its own lookup (`findActiveKaraokeWordIndex` in ReaderScreen)
 * with an equal-split cluster fix, and it samples on a 25 ms interval rather
 * than an animation frame. A word whose window is shorter than the sampling
 * period can be stepped over even when the lookup would have returned it, so
 * this replays the app's lookup AT ITS OWN CADENCE and counts what never
 * lights up. Compared against the web reader on the same payloads.
 *
 *   npx tsx scripts/_karaokeMobileSim.ts [--limit N]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import {
  coerceAudioWordTimings,
  type StoryWordToken,
} from "../src/lib/audioWordTimingsTypes";
import {
  buildWordWindows,
  createHighlightStepper,
  findActiveWordIndex,
} from "../src/lib/karaokeWordWindows";

const prisma = new PrismaClient();

/** Verbatim port of apps/mobile/src/mobile/ReaderScreen.tsx. */
function findActiveKaraokeWordIndex(
  words: StoryWordToken[],
  positionSec: number
): number | null {
  let last: number | null = null;
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (w.startSec === null) { i += 1; continue; }
    if (positionSec < w.startSec) break;

    const clusterStart = w.startSec;
    const cluster: number[] = [i];
    let j = i + 1;
    while (j < words.length) {
      const c = words[j].startSec;
      if (c === null) { j += 1; continue; }
      if (c === clusterStart) { cluster.push(j); j += 1; continue; }
      break;
    }

    let nextStart: number | null = null;
    let k = j;
    while (k < words.length) {
      const c = words[k].startSec;
      if (c !== null && c > clusterStart) { nextStart = c; break; }
      k += 1;
    }

    if (nextStart === null || positionSec < nextStart) {
      if (cluster.length === 1) return cluster[0];
      const FALLBACK_SLOT_SEC = 0.15;
      const slot = nextStart !== null ? (nextStart - clusterStart) / cluster.length : FALLBACK_SLOT_SEC;
      const offset = positionSec - clusterStart;
      const idxInCluster = Math.min(cluster.length - 1, Math.max(0, Math.floor(offset / slot)));
      return cluster[idxInCluster];
    }

    last = cluster[cluster.length - 1];
    i = j;
  }
  return last;
}

function sweep(
  words: StoryWordToken[],
  durationSec: number,
  stepSec: number,
  pick: (t: number) => number | null,
  missingOut?: number[]
): number {
  const seen = new Set<number>();
  // Wall clock advances with playback, so the minimum-dwell stepper is
  // exercised exactly as it is at runtime.
  const step = createHighlightStepper();
  let nowMs = 0;
  for (let t = 0; t <= durationSec + 0.5; t += stepSec) {
    const idx = step(pick(t), nowMs, t);
    nowMs += stepSec * 1000;
    if (idx !== null) seen.add(idx);
  }
  // The real reader keeps ticking after the audio stops (currentTime freezes
  // at the end), so the stepper still has time to finish catching up. Model
  // that instead of cutting the clock dead at the last sample.
  for (let k = 0; k < 120; k += 1) {
    const idx = step(pick(durationSec), nowMs, durationSec);
    nowMs += stepSec * 1000;
    if (idx !== null) seen.add(idx);
  }
  let missing = 0;
  for (let i = 0; i < words.length; i += 1)
    if (!seen.has(i)) { missing += 1; missingOut?.push(i); }
  return missing;
}

async function main() {
  const argv = process.argv.slice(2);
  const li = argv.indexOf("--limit");
  const limit = li >= 0 ? parseInt(argv[li + 1], 10) : undefined;

  const rows = await prisma.journeyStory.findMany({
    where: { audioWordTimings: { not: null }, audioUrl: { not: null } },
    select: { slug: true, audioWordTimings: true },
    orderBy: { updatedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  let words = 0;
  let mobileSkipped = 0;
  let webSkipped = 0;
  let tightMobile = 0; // windows shorter than the 25 ms sampling period
  let tightWeb = 0; // windows shorter than one 60 fps frame
  const worst: Array<{ slug: string; skipped: number; words: number }> = [];

  for (const row of rows) {
    const payload = coerceAudioWordTimings(row.audioWordTimings);
    if (!payload) continue;
    const dur = payload.audioDurationSec ?? 0;
    if (dur <= 0) continue;

    const windows = buildWordWindows(payload.words, payload.audioDurationSec);
    for (let k = 1; k < windows.length; k += 1) {
      const w = windows[k].startSec - windows[k - 1].startSec;
      if (w < 0.025) tightMobile += 1;
      if (w < 0.0167) tightWeb += 1;
    }

    const m = sweep(payload.words, dur, 0.025, (t) => findActiveKaraokeWordIndex(payload.words, t));
    const webMissing: number[] = [];
    const w = sweep(payload.words, dur, 0.0167, (t) => findActiveWordIndex(windows, t), webMissing);
    if (webMissing.length > 0) {
      for (const i of webMissing) {
        const win = windows.find((x) => x.index === i);
        const prev = windows[windows.findIndex((x) => x.index === i) - 1];
        const next = windows[windows.findIndex((x) => x.index === i) + 1];
        console.log(
          `  WEB salta ${row.slug} [${i}] "${payload.words[i].text}" ` +
            `win=${win?.startSec.toFixed(3)} prev=${prev?.startSec.toFixed(3)} next=${next?.startSec.toFixed(3)} dur=${dur.toFixed(2)}`
        );
      }
    }
    words += payload.words.length;
    mobileSkipped += m;
    webSkipped += w;
    if (m > 0) worst.push({ slug: row.slug ?? "?", skipped: m, words: payload.words.length });
  }

  worst.sort((a, b) => b.skipped - a.skipped);
  console.log(`historias: ${rows.length} | palabras: ${words}`);
  console.log(`  nunca resaltadas en MOVIL (muestreo 25 ms): ${mobileSkipped} (${((100 * mobileSkipped) / words).toFixed(2)}%)`);
  console.log(`  nunca resaltadas en WEB   (muestreo 16 ms): ${webSkipped} (${((100 * webSkipped) / words).toFixed(2)}%)`);
  console.log(`  ventanas mas cortas que el muestreo movil (25 ms): ${tightMobile}`);
  console.log(`  ventanas mas cortas que un frame web (16.7 ms):    ${tightWeb}`);
  if (worst.length) {
    console.log("\npeores en movil:");
    for (const x of worst.slice(0, 10)) console.log(`  ${x.slug.padEnd(34)} ${x.skipped}/${x.words}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
