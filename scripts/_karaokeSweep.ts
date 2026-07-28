/**
 * Tier 1 sweep: score EVERY stored payload (journey + catalog) against the
 * audio itself, with no STT, so it is fast enough to cover all of them.
 *
 * Ground truth = ffmpeg speech onsets (end of each real pause, accurate to
 * ~30 ms). A correct alignment must start SOME word at every speech onset, so
 * the distance from each onset to the nearest word start measures gross
 * misalignment without needing to know which word it is.
 *
 * Anything this flags then goes to the whisper ruler for confirmation.
 *
 *   npx tsx scripts/_karaokeSweep.ts --out report.json [--limit N]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { spawn } from "child_process";
import { mkdtempSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { coerceAudioWordTimings } from "../src/lib/audioWordTimingsTypes";
import { detectSilences } from "../src/lib/detectSilences";
import { buildWordWindows } from "../src/lib/karaokeWordWindows";

const prisma = new PrismaClient();

function ffprobe(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1", file,
    ]);
    let out = "";
    p.stdout.on("data", (c: Buffer) => (out += c.toString()));
    p.on("error", reject);
    p.on("close", () => resolve(parseFloat(out.trim())));
  });
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

async function main() {
  const argv = process.argv.slice(2);
  const at = (f: string) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const outPath = at("--out");
  const limit = at("--limit") ? parseInt(at("--limit")!, 10) : undefined;

  const journeys = await prisma.journeyStory.findMany({
    where: { audioWordTimings: { not: null }, audioUrl: { not: null } },
    select: { slug: true, audioUrl: true, audioWordTimings: true },
  });
  const catalogTimings = await prisma.catalogStoryAudioTimings.findMany({
    select: { slug: true, audioWordTimings: true },
  });
  const catalogStories = await prisma.catalogStory.findMany({
    select: { slug: true, audio: true, audioUrl: true },
  });
  const audioBySlug = new Map(
    catalogStories.map((s) => [s.slug, s.audioUrl || s.audio] as const)
  );

  type Item = { kind: string; slug: string; audioUrl: string; raw: unknown };
  const items: Item[] = [];
  for (const j of journeys) {
    if (j.audioUrl) items.push({ kind: "journey", slug: j.slug ?? "?", audioUrl: j.audioUrl, raw: j.audioWordTimings });
  }
  for (const c of catalogTimings) {
    const a = audioBySlug.get(c.slug);
    if (a) items.push({ kind: "catalog", slug: c.slug, audioUrl: a, raw: c.audioWordTimings });
  }
  const todo = limit ? items.slice(0, limit) : items;

  const dir = mkdtempSync(path.join(tmpdir(), "karaoke-sweep-"));
  const report: Record<string, unknown>[] = [];
  let done = 0;

  for (const item of todo) {
    done += 1;
    const payload = coerceAudioWordTimings(item.raw);
    if (!payload) continue;
    const file = path.join(dir, `${item.kind}-${item.slug}.mp3`);
    try {
      const res = await fetch(item.audioUrl);
      if (!res.ok) {
        console.log(`[${done}/${todo.length}] ${item.slug} SKIP audio ${res.status}`);
        continue;
      }
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      const duration = await ffprobe(file);

      // Walk the same threshold ladder the aligner uses, so an ambient bed
      // does not look like "no pauses at all".
      let silences: Awaited<ReturnType<typeof detectSilences>> = [];
      for (const db of [-35, -30, -27, -24]) {
        silences = await detectSilences(file, { thresholdDb: db, minDurationSec: 0.3 });
        if (silences.filter((s) => s.end < duration - 0.2).length >= 3) break;
      }

      const windows = buildWordWindows(payload.words, payload.audioDurationSec);
      const starts = windows.map((w) => w.startSec);
      const errs: number[] = [];
      for (const sil of silences) {
        if (sil.end >= duration - 0.2) continue;
        if (sil.duration < 0.3) continue;
        let best = Infinity;
        for (const s of starts) {
          const d = Math.abs(s - sil.end);
          if (d < best) best = d;
          if (s > sil.end && d > best) break;
        }
        if (Number.isFinite(best)) errs.push(best);
      }
      // words starting while nothing is being spoken
      let ghosts = 0;
      for (const s of starts) {
        for (const sil of silences) {
          if (sil.duration < 0.3) continue;
          if (s > sil.start + 0.1 && s < sil.end - 0.1) { ghosts += 1; break; }
        }
      }
      const sorted = [...errs].sort((a, b) => a - b);
      const median = quantile(sorted, 0.5);
      const p90 = quantile(sorted, 0.9);
      const ghostRate = starts.length ? ghosts / starts.length : 0;
      const overrun =
        Math.max(...payload.words.map((w) => (w.endSec ?? w.startSec) ?? 0)) - duration;

      const flagged =
        errs.length < 3 ||
        median > 0.15 ||
        p90 > 0.5 ||
        ghostRate > 0.05 ||
        overrun > 0.05;

      report.push({
        kind: item.kind, slug: item.slug, onsets: errs.length,
        median: +median.toFixed(3), p90: +p90.toFixed(3),
        ghostRate: +ghostRate.toFixed(4), overrun: +overrun.toFixed(3),
        words: payload.words.length, flagged,
      });
      console.log(
        `[${done}/${todo.length}] ${flagged ? "FLAG" : "ok  "} ${item.kind}/${item.slug} ` +
          `onsets=${errs.length} med=${median.toFixed(3)} p90=${p90.toFixed(3)} ghosts=${(100 * ghostRate).toFixed(1)}%`
      );
    } catch (err) {
      console.log(`[${done}/${todo.length}] ${item.slug} ERROR ${err instanceof Error ? err.message : err}`);
    } finally {
      try { unlinkSync(file); } catch { /* already gone */ }
    }
  }

  const flagged = report.filter((r) => r.flagged);
  console.log(`\nanalizadas: ${report.length} | señaladas: ${flagged.length}`);
  if (outPath) {
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`reporte: ${outPath}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
