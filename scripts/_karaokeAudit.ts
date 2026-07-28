/**
 * Karaoke alignment audit (read-only).
 *
 * Measures how well the stored word timings match the REAL audio, using
 * ffmpeg silencedetect as ground truth for speech onsets. No STT needed:
 * every speech onset (end of a detected silence) must coincide with the
 * start of SOME token. The signed error at each onset tells us whether the
 * highlight runs early or late, and how the error grows over the story.
 *
 * Usage:
 *   npx tsx scripts/_karaokeAudit.ts --limit 8 [--lang ES] [--json out.json]
 */
import { spawn } from "child_process";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { coerceAudioWordTimings } from "../src/lib/audioWordTimingsTypes";

const prisma = new PrismaClient();

type Silence = { start: number; end: number; duration: number };

function run(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "";
    let err = "";
    p.stdout.on("data", (c: Buffer) => (out += c.toString("utf-8")));
    p.stderr.on("data", (c: Buffer) => (err += c.toString("utf-8")));
    p.on("error", reject);
    p.on("close", (code) => resolve({ code: code ?? 0, out, err }));
  });
}

async function probeDuration(file: string): Promise<number> {
  const { out } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    file,
  ]);
  return parseFloat(out.trim());
}

async function detectSilences(
  file: string,
  thresholdDb = -35,
  minDur = 0.25
): Promise<Silence[]> {
  const { err } = await run("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    file,
    "-af",
    `silencedetect=noise=${thresholdDb}dB:duration=${minDur}`,
    "-f",
    "null",
    "-",
  ]);
  const starts: number[] = [];
  const spans: Silence[] = [];
  const startRe = /silence_start:\s*(-?[\d.]+)/g;
  const endRe = /silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(err)) !== null) starts.push(parseFloat(m[1]));
  let i = 0;
  while ((m = endRe.exec(err)) !== null) {
    const end = parseFloat(m[1]);
    const duration = parseFloat(m[2]);
    spans.push({ start: starts[i] ?? end - duration, end, duration });
    i += 1;
  }
  return spans;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

type Stats = { n: number; mean: number; median: number; p90: number; max: number };
function stats(values: number[]): Stats {
  const s = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  return {
    n: values.length,
    mean,
    median: quantile(s, 0.5),
    p90: quantile(s, 0.9),
    max: s[s.length - 1] ?? NaN,
  };
}

/**
 * For every real speech onset (= end of a detected silence), find the token
 * start closest to it and return the SIGNED error (tokenStart - onset).
 * Positive = the highlight fires LATE (word lights up after the narrator
 * already started speaking it). Negative = early.
 */
function onsetErrors(
  words: { startSec: number | null }[],
  silences: Silence[],
  duration: number
): { t: number; err: number }[] {
  const starts = words
    .map((w) => w.startSec)
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => a - b);
  if (starts.length === 0) return [];
  const out: { t: number; err: number }[] = [];
  for (const sil of silences) {
    // Ignore the trailing silence (no speech onset follows it).
    if (sil.end >= duration - 0.05) continue;
    // Ignore very short gaps: those are intra-phrase breaths where the
    // token boundary is genuinely ambiguous.
    if (sil.duration < 0.3) continue;
    let best = Infinity;
    for (const s of starts) {
      const d = s - sil.end;
      if (Math.abs(d) < Math.abs(best)) best = d;
      if (d > 0 && Math.abs(d) > Math.abs(best)) break;
    }
    if (Number.isFinite(best)) out.push({ t: sil.end, err: best });
  }
  return out;
}

export type SpeechSpan = { start: number; end: number };

/** Complement of the (meaningful) silences inside [0, duration]. */
export function speechSpans(
  silences: Silence[],
  duration: number,
  minSil = 0.3
): SpeechSpan[] {
  const sil = silences.filter((s) => s.duration >= minSil).sort((a, b) => a.start - b.start);
  const spans: SpeechSpan[] = [];
  let cursor = 0;
  for (const s of sil) {
    if (s.start > cursor + 0.05) spans.push({ start: cursor, end: s.start });
    cursor = Math.max(cursor, s.end);
  }
  if (duration - cursor > 0.05) spans.push({ start: cursor, end: duration });
  return spans;
}

/**
 * Per speech span, how well do the tokens assigned to it fit its real
 * boundaries? `startErr` = firstTokenStart - spanStart (the metric the drift
 * anchors already optimise). `endErr` = lastTokenEnd - spanEnd, which is what
 * an offset-only correction CANNOT fix: shifting a whole block forward makes
 * its last word end after the narrator already stopped.
 */
function spanFitErrors(
  words: { startSec: number | null; endSec: number | null }[],
  spans: SpeechSpan[]
): { t: number; startErr: number; endErr: number; tokens: number }[] {
  const toks = words
    .filter((w): w is { startSec: number; endSec: number | null } => typeof w.startSec === "number")
    .sort((a, b) => a.startSec - b.startSec);
  const out: { t: number; startErr: number; endErr: number; tokens: number }[] = [];
  for (const span of spans) {
    // A token belongs to this span when its start lands inside it, or when it
    // is the closest token to the span (tolerating the drift we're measuring).
    const mid = (span.start + span.end) / 2;
    const inside = toks.filter((t) => t.startSec >= span.start - 0.35 && t.startSec <= span.end + 0.35);
    if (inside.length === 0) continue;
    const first = inside[0];
    const last = inside[inside.length - 1];
    const lastEnd = typeof last.endSec === "number" ? last.endSec : last.startSec;
    out.push({
      t: +mid.toFixed(2),
      startErr: first.startSec - span.start,
      endErr: lastEnd - span.end,
      tokens: inside.length,
    });
  }
  return out;
}

/** Fraction of token starts that land inside a real silence (nothing is being
 * spoken, so the highlight is provably on the wrong word). */
function ghostRate(words: { startSec: number | null }[], silences: Silence[]): number {
  const starts = words.map((w) => w.startSec).filter((v): v is number => typeof v === "number");
  if (starts.length === 0) return 0;
  let ghosts = 0;
  for (const s of starts) {
    for (const sil of silences) {
      if (sil.duration < 0.3) continue;
      if (s > sil.start + 0.1 && s < sil.end - 0.1) {
        ghosts += 1;
        break;
      }
    }
  }
  return ghosts / starts.length;
}

async function main() {
  const argv = process.argv.slice(2);
  const getArg = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const limit = parseInt(getArg("--limit") ?? "8", 10);
  const langFilter = getArg("--lang");
  const jsonOut = getArg("--json");

  const rows = await prisma.journeyStory.findMany({
    where: {
      audioUrl: { not: null },
      audioWordTimings: { not: null },
      ...(langFilter ? { journey: { language: langFilter } } : {}),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      audioUrl: true,
      audioWordTimings: true,
      level: true,
      journey: { select: { language: true, variant: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  console.log(`Auditing ${rows.length} stories with word timings\n`);
  const dir = mkdtempSync(path.join(tmpdir(), "karaoke-audit-"));
  const report: Record<string, unknown>[] = [];

  for (const row of rows) {
    const payload = coerceAudioWordTimings(row.audioWordTimings);
    if (!payload || !row.audioUrl) {
      console.log(`SKIP ${row.slug}: unusable payload`);
      continue;
    }
    const file = path.join(dir, `${row.slug}.mp3`);
    const res = await fetch(row.audioUrl);
    if (!res.ok) {
      console.log(`SKIP ${row.slug}: audio fetch ${res.status}`);
      continue;
    }
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));

    const duration = await probeDuration(file);
    const silences = await detectSilences(file);
    const errs = onsetErrors(payload.words, silences, duration);
    const absErrs = errs.map((e) => Math.abs(e.err));
    const st = stats(absErrs);

    let span = 0;
    for (const w of payload.words) {
      const end = typeof w.endSec === "number" ? w.endSec : w.startSec;
      if (typeof end === "number" && end > span) span = end;
    }
    const firstStart = payload.words.find((w) => w.startSec !== null)?.startSec ?? NaN;
    const firstSpeech = silences.length > 0 && silences[0].start < 0.5 ? silences[0].end : 0;

    // Split the onset errors in halves to see if the error accumulates.
    const half = Math.floor(errs.length / 2);
    const early = stats(errs.slice(0, half).map((e) => e.err));
    const late = stats(errs.slice(half).map((e) => e.err));

    const spans = speechSpans(silences, duration);
    const fits = spanFitErrors(payload.words, spans);
    const spanStartErr = stats(fits.map((f) => f.startErr));
    const spanEndErr = stats(fits.map((f) => f.endErr));

    const entry = {
      slug: row.slug,
      lang: row.journey.language,
      variant: row.journey.variant,
      level: row.level,
      durationSec: +duration.toFixed(2),
      timingsSpanSec: +span.toFixed(2),
      tailOverrunSec: +(span - duration).toFixed(2),
      headErrorSec: +(firstStart - firstSpeech).toFixed(2),
      onsets: st.n,
      absErrMeanSec: +st.mean.toFixed(3),
      absErrMedianSec: +st.median.toFixed(3),
      absErrP90Sec: +st.p90.toFixed(3),
      absErrMaxSec: +st.max.toFixed(3),
      signedErrFirstHalfSec: +early.mean.toFixed(3),
      signedErrSecondHalfSec: +late.mean.toFixed(3),
      ghostRate: +ghostRate(payload.words, silences).toFixed(4),
      words: payload.words.length,
      speechSpans: fits.length,
      spanStartErrMeanSec: +spanStartErr.mean.toFixed(3),
      spanEndErrMeanSec: +spanEndErr.mean.toFixed(3),
      spanEndErrMaxSec: +spanEndErr.max.toFixed(3),
      worstOnsets: errs
        .map((e) => ({ t: +e.t.toFixed(2), err: +e.err.toFixed(2) }))
        .sort((a, b) => Math.abs(b.err) - Math.abs(a.err))
        .slice(0, 5),
      worstSpanEnds: fits
        .map((f) => ({ t: f.t, endErr: +f.endErr.toFixed(2), tokens: f.tokens }))
        .sort((a, b) => Math.abs(b.endErr) - Math.abs(a.endErr))
        .slice(0, 5),
    };
    report.push(entry);
    console.log(
      `${row.slug} [${row.journey.language}/${row.journey.variant}] dur=${entry.durationSec}s ` +
        `overrun=${entry.tailOverrunSec}s | onsets=${entry.onsets} ` +
        `|err| med=${entry.absErrMedianSec}s p90=${entry.absErrP90Sec}s max=${entry.absErrMaxSec}s ` +
        `| spans=${entry.speechSpans} startErr=${entry.spanStartErrMeanSec}s endErr=${entry.spanEndErrMeanSec}s (max ${entry.spanEndErrMaxSec}s) ` +
        `| ghosts=${entry.ghostRate}`
    );
  }

  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(report, null, 2));
    console.log(`\nwrote ${jsonOut}`);
  }
  console.log(`\naudio cached in ${dir}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
