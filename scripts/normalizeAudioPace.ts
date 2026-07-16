/**
 * Audio pacing tool for multi-voice journey stories.
 *
 * `--apply` REQUIRES the react-server condition, because regenerating the word
 * timings pulls in a server-only module:
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/normalizeAudioPace.ts --apply 2.8 <slug>
 * `--measure` runs fine without it. Omitting it on --apply used to corrupt the
 * story silently; it now fails before writing anything (see apply()).
 *
 * WHY: a fixed atempo (e.g. 0.90 for all) does NOT make stories sound equally
 * paced, because each story's native articulation rate differs (e.g. la-combi
 * native = 2.91 w/s, the fastest in the latam journey — which is why the
 * places-getting-around topic felt fast). The right approach is to measure
 * each story's speaking rate and compute the per-story atempo that lands it on
 * a single journey-wide TARGET rate.
 *
 * METRIC: articulation rate = total words / total speaking time, where speaking
 * time = sum(endSec - startSec) over audioFragments (EXCLUDES inter-segment
 * pauses). Computed instantly from audioFragments — no Scribe, no credits.
 *
 * Usage:
 *   npx tsx scripts/normalizeAudioPace.ts --measure <slug> [<slug>...]
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/normalizeAudioPace.ts --apply <targetRate> <slug> [<slug>...]
 *
 * --apply re-encodes the master + every section with atempo = target/current
 * (ffmpeg, no TTS/credits), rescales fragment offsets, clears prevUrl, and
 * re-runs forced alignment so karaoke timings stay correct. Non-destructive to
 * the synthesis; idempotent-ish because it strips a prior `_slow<ts>` suffix
 * before re-encoding, but applying twice compounds atempo — measure first.
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

const prisma = new PrismaClient();
const wc = (t: string) => (t || "").trim().split(/\s+/).filter(Boolean).length;

async function fragmentsFor(slug: string) {
  const s = await prisma.journeyStory.findFirst({
    where: { slug },
    select: { id: true, audioUrl: true, audioFilename: true, audioFragments: true },
  });
  if (!s?.audioUrl) return null;
  const frags: any[] = Array.isArray(s.audioFragments) ? (s.audioFragments as any) : [];
  return { ...s, frags };
}

function rate(frags: any[]) {
  let words = 0, speak = 0, gross = 0;
  for (const f of frags) { words += wc(f.text); speak += f.endSec - f.startSec; gross = Math.max(gross, f.endSec); }
  return { words, speak: +speak.toFixed(1), gross: +gross.toFixed(1), artic: +(words / speak).toFixed(2), grossR: +(words / gross).toFixed(2) };
}

async function dl(url: string): Promise<Buffer> {
  let e: unknown;
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error("HTTP " + r.status); return Buffer.from(await r.arrayBuffer()); }
    catch (err) { e = err; await new Promise((res) => setTimeout(res, 800 * (i + 1))); }
  }
  throw e;
}
function atempo(buf: Buffer, ratio: number, dir: string, name: string): Buffer {
  const i = join(dir, name + "i.mp3"), o = join(dir, name + "o.mp3");
  writeFileSync(i, buf);
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", i, "-filter:a", `atempo=${ratio}`, "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "192k", o]);
  if (r.status !== 0) throw new Error("ffmpeg " + r.stderr.toString().slice(0, 150));
  return readFileSync(o);
}

async function apply(slug: string, target: number) {
  const s = await fragmentsFor(slug);
  if (!s) { console.log(`[${slug}] sin audio`); return; }
  const cur = rate(s.frags).artic;
  const ratio = +(target / cur).toFixed(3);
  if (Math.abs(ratio - 1) < 0.01) { console.log(`[${slug}] ya en objetivo (${cur} w/s)`); return; }
  // Load the word-timings module BEFORE mutating anything (2026-07-09). It used
  // to be imported at the end, after the slowed audio was already uploaded and
  // written to the DB — so running this without
  // NODE_OPTIONS="--conditions=react-server" threw on the import and left the
  // story with NEW audio and OLD timings: the mp3 ran 100.9s while
  // audioWordTimings still said 92.7s, i.e. karaoke ~8s ahead by the end. And a
  // re-run was no help: it measured the already-paced audio, said "ya en
  // objetivo" and returned without ever fixing the timings. Failing here costs
  // nothing; failing after the write is silent corruption.
  const { generateWordTimingsForStory } = await import("../src/lib/audioWordTimings");
  const scale = 1 / ratio;
  const tmp = mkdtempSync(join(tmpdir(), "np-")), ts = Date.now();
  const base = (s.audioFilename || slug).replace(/\.mp3$/, "").replace(/_slow\d+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const mUp = await uploadPublicObject({ key: `media/generated/audio/${base}_slow${ts}.mp3`, body: atempo(await dl(s.audioUrl!), ratio, tmp, "m"), contentType: "audio/mpeg" });
  const nf: any[] = [];
  for (const f of s.frags) {
    let url = f.url;
    if (f.url) {
      const sb = (f.url.split("/").pop() || "sec").replace(/\.mp3$/, "").replace(/_slow\d+$/, "");
      const up = await uploadPublicObject({ key: `media/generated/audio/sections/${sb}_slow${ts}.mp3`, body: atempo(await dl(f.url), ratio, tmp, "s" + f.index), contentType: "audio/mpeg" });
      url = up?.url || f.url;
    }
    nf.push({ ...f, url, prevUrl: null, startSec: +(f.startSec * scale).toFixed(3), endSec: +(f.endSec * scale).toFixed(3) });
  }
  await prisma.journeyStory.update({ where: { id: s.id }, data: { audioUrl: mUp!.url, audioFilename: `${base}_slow${ts}.mp3`, audioFragments: nf as any } });
  rmSync(tmp, { recursive: true, force: true });
  // Do NOT swallow this: stale timings against new audio are worse than a loud
  // failure, and the re-run won't catch it (see the note above).
  await generateWordTimingsForStory(s.id);
  console.log(`[${slug}] ✓ ${cur} → ${target} w/s (atempo ${ratio}, ${nf.length} secciones)`);
}

(async () => {
  const args = process.argv.slice(2);
  if (args[0] === "--measure") {
    for (const slug of args.slice(1)) {
      const s = await fragmentsFor(slug);
      if (!s) { console.log(`${slug}: sin audio`); continue; }
      const m = rate(s.frags);
      console.log(`${slug.padEnd(32)} artic=${m.artic} w/s  gross=${m.grossR} w/s  (${m.words}w, habla ${m.speak}s)`);
    }
  } else if (args[0] === "--apply") {
    const target = parseFloat(args[1]);
    if (!Number.isFinite(target)) { console.log("uso: --apply <targetRate> <slug...>"); process.exit(1); }
    for (const slug of args.slice(2)) { try { await apply(slug, target); } catch (e: any) { console.log(`[${slug}] ERR ${e.message}`); } }
  } else {
    console.log("uso: --measure <slug...>  |  --apply <targetRate> <slug...>");
  }
  await prisma.$disconnect();
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
