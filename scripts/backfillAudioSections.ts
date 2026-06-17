/**
 * Backfill `audioFragments` for an existing multi-voice story so it becomes
 * editable in the Studio audio editor — EXACTLY the method that produced
 * La combi equivocada (which the user validated as good):
 *
 *   1. Scribe (ElevenLabs STT) the existing master → word-level timestamps.
 *   2. Align the transcript to the expected segment texts (optional spoken
 *      title first, then each dialogueSpec turn in order) → raw per-segment
 *      [startSec, endSec].
 *   3. Snap each inter-segment boundary to a SILENCE in the master
 *      (ffmpeg silencedetect), falling back to the raw midpoint. This is
 *      what keeps cuts from clipping words.
 *   4. Slice the master at those boundaries into per-section files
 *      (re-encode, NO loudnorm — the master is already at catalog level)
 *      and upload each to R2.
 *   5. Write `audioFragments` (index/speaker/voiceId/startSec/endSec/url/
 *      text). The master itself is NEVER rewritten → 0% risk to the audio
 *      that already plays.
 *
 * NON-destructive: only adds section files + the audioFragments column.
 * Re-running overwrites cleanly. Costs ~0 ElevenLabs TTS credits (Scribe
 * STT only; no synthesis).
 *
 * Usage:
 *   npx tsx scripts/backfillAudioSections.ts <slug> [<slug> ...]
 *   npx tsx scripts/backfillAudioSections.ts --dry <slug>      (report only, no DB write, no upload)
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";

const KEY = (process.env.ELEVENLABS_API_KEY || "").trim();
const prisma = new PrismaClient();

// Silence snapping window: a boundary is snapped to a detected silence
// whose interval lies within this many seconds of the raw boundary.
const SNAP_WINDOW = Number(process.env.BF_SNAP_WINDOW || "0.7");
const SILENCE_NOISE = process.env.BF_SILENCE_NOISE || "-30dB";
const SILENCE_MIN = Number(process.env.BF_SILENCE_MIN || "0.16");

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]/g, "");

type ScribeWord = { w: string; start: number; end: number };
type Silence = { start: number; end: number };

async function scribe(buf: Buffer): Promise<ScribeWord[]> {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1");
  fd.append("language_code", "spa");
  fd.append("file", new Blob([buf], { type: "audio/mpeg" }), "master.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": KEY },
    body: fd,
  });
  if (!res.ok) throw new Error(`Scribe ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j: any = await res.json();
  return (j.words || [])
    .filter((x: any) => x.type === "word" && norm(x.text))
    .map((x: any) => ({ w: norm(x.text), start: x.start, end: x.end }));
}

async function download(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function ffprobeDuration(path: string): number {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path]);
  return parseFloat(r.stdout.toString().trim()) || 0;
}

function detectSilences(path: string): Silence[] {
  const r = spawnSync("ffmpeg", ["-i", path, "-af", `silencedetect=noise=${SILENCE_NOISE}:d=${SILENCE_MIN}`, "-f", "null", "-"], { encoding: "utf8" });
  const err = r.stderr.toString();
  const sil: Silence[] = [];
  let curStart: number | null = null;
  for (const line of err.split("\n")) {
    const ms = line.match(/silence_start:\s*(-?[\d.]+)/);
    const me = line.match(/silence_end:\s*(-?[\d.]+)/);
    if (ms) curStart = parseFloat(ms[1]);
    if (me && curStart !== null) { sil.push({ start: curStart, end: parseFloat(me[1]) }); curStart = null; }
  }
  return sil;
}

/** Snap a raw boundary to the midpoint of the nearest silence interval
 *  within SNAP_WINDOW; else return the raw boundary (flagged). */
function snap(raw: number, silences: Silence[]): { t: number; snapped: boolean } {
  let best: { t: number; d: number } | null = null;
  for (const s of silences) {
    const mid = (s.start + s.end) / 2;
    // candidate = the silence point closest to raw, clamped into the interval
    const cand = raw < s.start ? s.start : raw > s.end ? s.end : raw;
    const d = Math.abs(cand - raw);
    const useMid = s.end - s.start > 0.05 ? mid : cand;
    if (d <= SNAP_WINDOW && (!best || d < best.d)) best = { t: useMid, d };
  }
  return best ? { t: best.t, snapped: true } : { t: raw, snapped: false };
}

/** Sequential tolerant alignment: map each expected segment's words onto
 *  the scribe stream, returning raw [startSec,endSec] per segment. */
function alignSegments(expected: { segIdx: number; words: string[] }[], scribe: ScribeWord[]) {
  const flat: { segIdx: number; w: string }[] = [];
  for (const e of expected) for (const w of e.words) flat.push({ segIdx: e.segIdx, w });
  const segStart: Record<number, number> = {};
  const segEnd: Record<number, number> = {};
  let i = 0; // expected
  let j = 0; // scribe
  const K = 6; // resync look-ahead
  const map = (segIdx: number, sw: ScribeWord) => {
    if (segStart[segIdx] === undefined) segStart[segIdx] = sw.start;
    segEnd[segIdx] = sw.end;
  };
  while (i < flat.length && j < scribe.length) {
    if (flat[i].w === scribe[j].w) { map(flat[i].segIdx, scribe[j]); i++; j++; continue; }
    // try to find expected[i] ahead in scribe (scribe inserted words)
    let k = 1; let found = -1;
    for (; k <= K && j + k < scribe.length; k++) if (scribe[j + k].w === flat[i].w) { found = k; break; }
    if (found > 0) { j += found; continue; }
    // try to find scribe[j] ahead in expected (scribe dropped words)
    k = 1; found = -1;
    for (; k <= K && i + k < flat.length; k++) if (flat[i + k].w === scribe[j].w) { found = k; break; }
    if (found > 0) { i += found; continue; }
    // substitution: count scribe word toward current expected segment, advance both
    map(flat[i].segIdx, scribe[j]); i++; j++;
  }
  return { segStart, segEnd };
}

function cutSection(masterPath: string, start: number, end: number, outPath: string) {
  const r = spawnSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", masterPath,
    "-ss", start.toFixed(3), "-to", end.toFixed(3),
    "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "192k",
    outPath,
  ]);
  if (r.status !== 0) throw new Error(`cut failed: ${r.stderr.toString().slice(0, 200)}`);
}

async function backfill(slug: string, dry: boolean) {
  const story = await prisma.journeyStory.findFirst({
    where: { slug },
    select: { id: true, slug: true, title: true, audioUrl: true, audioFilename: true, dialogueSpec: true },
  });
  if (!story) { console.log(`\n[${slug}] NOT FOUND`); return; }
  if (!story.audioUrl) { console.log(`\n[${slug}] no audioUrl`); return; }
  const spec: any[] = Array.isArray(story.dialogueSpec) ? (story.dialogueSpec as any) : [];
  if (spec.length < 2) { console.log(`\n[${slug}] dialogueSpec too short (${spec.length})`); return; }

  console.log(`\n[${slug}] ${spec.length} segments — scribing master…`);
  const tmp = mkdtempSync(join(tmpdir(), "bf-"));
  const masterPath = join(tmp, "master.mp3");
  const masterBuf = await download(story.audioUrl);
  writeFileSync(masterPath, masterBuf);
  const dur = ffprobeDuration(masterPath);
  const words = await scribe(masterBuf);
  const silences = detectSilences(masterPath);

  // Detect spoken title: do the master's first words match the story title?
  const titleTokens = norm(story.title).match(/.+/) ? story.title.split(/\s+/).map(norm).filter(Boolean) : [];
  const head = words.slice(0, Math.max(titleTokens.length + 2, 4)).map((w) => w.w).join(" ");
  const titleMatch = titleTokens.length > 0 && titleTokens.filter((t) => head.includes(t)).length >= Math.ceil(titleTokens.length * 0.6);

  // Expected segment list: [title?] + each dialogueSpec turn.
  const expected: { segIdx: number; words: string[]; speaker: string; voiceId: string; text: string }[] = [];
  let idx = 0;
  const narratorVoice = spec[0].voice;
  if (titleMatch) {
    expected.push({ segIdx: idx++, words: titleTokens, speaker: "narrator", voiceId: narratorVoice, text: story.title });
  }
  for (const seg of spec) {
    expected.push({
      segIdx: idx++,
      words: String(seg.text || "").split(/\s+/).map(norm).filter(Boolean),
      speaker: seg.speaker || "narrator",
      voiceId: seg.voice,
      text: seg.text || "",
    });
  }

  const { segStart, segEnd } = alignSegments(expected.map((e) => ({ segIdx: e.segIdx, words: e.words })), words);

  // Build boundaries. Boundary[k] = end of segment k / start of k+1.
  // First segment starts at 0; last ends at master duration.
  const n = expected.length;
  const lost: number[] = [];
  for (let k = 0; k < n; k++) {
    if (segStart[k] === undefined || segEnd[k] === undefined) lost.push(k);
  }
  // Fill any lost segment offsets by linear interpolation between known neighbours.
  for (let k = 0; k < n; k++) {
    if (segStart[k] === undefined) {
      const prevEnd = k > 0 && segEnd[k - 1] !== undefined ? segEnd[k - 1] : 0;
      const nextStart = (() => { for (let m = k + 1; m < n; m++) if (segStart[m] !== undefined) return segStart[m]; return dur; })();
      segStart[k] = prevEnd; segEnd[k] = (prevEnd + nextStart) / 2;
    }
  }

  const boundaries: { t: number; snapped: boolean }[] = [];
  for (let k = 0; k < n - 1; k++) {
    const raw = (segEnd[k] + segStart[k + 1]) / 2;
    boundaries.push(snap(raw, silences));
  }

  // Per-segment [start,end] from boundaries.
  const ranges: { start: number; end: number }[] = [];
  for (let k = 0; k < n; k++) {
    const start = k === 0 ? 0 : boundaries[k - 1].t;
    const end = k === n - 1 ? dur : boundaries[k].t;
    ranges.push({ start, end });
  }

  // Report.
  const flagged = boundaries.map((b, k) => (!b.snapped ? k : -1)).filter((x) => x >= 0);
  console.log(`  title=${titleMatch ? "yes" : "no"}  dur=${dur.toFixed(1)}s  silences=${silences.length}  fragments=${n}`);
  console.log(`  boundaries snapped-to-silence: ${boundaries.filter((b) => b.snapped).length}/${boundaries.length}` +
    (flagged.length ? `  ⚠ no-silence at seg-gaps: [${flagged.join(",")}]` : "  ✓ all clean") +
    (lost.length ? `  ⚠ alignment-lost segs: [${lost.join(",")}]` : ""));

  if (dry) { rmSync(tmp, { recursive: true, force: true }); return; }

  // Slice + upload + assemble fragments.
  const base = (story.audioFilename || `${slug}.mp3`).replace(/\.mp3$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const ts = Date.now();
  const fragments: any[] = [];
  for (let k = 0; k < n; k++) {
    const e = expected[k];
    const { start, end } = ranges[k];
    const outPath = join(tmp, `sec${String(k).padStart(2, "0")}.mp3`);
    cutSection(masterPath, start, end, outPath);
    const up = await uploadPublicObject({
      key: `media/generated/audio/sections/${base}_sec${String(k).padStart(2, "0")}_bf${ts}.mp3`,
      body: readFileSync(outPath),
      contentType: "audio/mpeg",
    });
    fragments.push({
      index: k, speaker: e.speaker, voiceId: e.voiceId,
      startSec: Number(start.toFixed(3)), endSec: Number(end.toFixed(3)),
      url: up?.url || null, prevUrl: null, text: e.text,
    });
  }

  await prisma.journeyStory.update({ where: { id: story.id }, data: { audioFragments: fragments } });
  console.log(`  ✓ wrote ${fragments.length} fragments + uploaded sections.`);
  rmSync(tmp, { recursive: true, force: true });
}

(async () => {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const slugs = args.filter((a) => !a.startsWith("--"));
  if (!slugs.length) { console.log("usage: backfillAudioSections.ts [--dry] <slug> [<slug>...]"); process.exit(1); }
  for (const slug of slugs) {
    try { await backfill(slug, dry); }
    catch (e: any) { console.log(`  ERR [${slug}]: ${e.message}`); }
  }
  await prisma.$disconnect();
})();
