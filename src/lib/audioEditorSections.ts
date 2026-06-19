import "server-only";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";
import { uploadPublicObject } from "@/lib/objectStorage";
import { spliceOnModal } from "@/lib/audioEditorSplice";

const GAP_SEC = 0.45;
const MASTER_BITRATE = "192k";

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (c) => { stderr += c.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 400)}`))));
  });
}

/**
 * Loudness-normalize one section (single loudnorm pass, no dynaudnorm) so
 * a fresh TTS take — esp. v3, which runs hot — sits at the catalog level
 * (~-16 LUFS) without clipping, and without the pumping/quality loss of a
 * heavier dynaudnorm+loudnorm chain run multiple times.
 */
async function normalizeSectionAudio(buffer: Buffer): Promise<Buffer> {
  const dir = mkdtempSync(join(tmpdir(), "secnorm-"));
  try {
    const inPath = join(dir, "in.mp3");
    const outPath = join(dir, "out.mp3");
    writeFileSync(inPath, buffer);
    await runFfmpeg([
      "-y", "-loglevel", "error", "-i", inPath,
      "-af", "loudnorm=I=-16:LRA=11:TP=-1.5",
      "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", MASTER_BITRATE, outPath,
    ]);
    return readFileSync(outPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Concatenate section buffers into one master, RE-ENCODING (not stream-
 * copy) so mismatched input formats — backfilled cuts vs fresh sections —
 * can't drop/truncate content. Inserts a fixed gap between sections via
 * the concat FILTER with per-input aformat normalization. Does NOT
 * loudnorm here: the sections are already at catalog level (backfill cuts
 * come from the normalized master; regenerated sections are normalized
 * individually), so a second loudnorm would just double-compress.
 */
function ffprobeFormat(path: string): { sampleRate: number; channels: number } {
  const r = spawnSync("ffprobe", [
    "-v", "error", "-select_streams", "a:0",
    "-show_entries", "stream=sample_rate,channels", "-of", "default=nw=1:nk=1", path,
  ]);
  const nums = (r.stdout?.toString() ?? "").trim().split(/\s+/).map((n) => parseInt(n, 10));
  return { sampleRate: nums[0] || 0, channels: nums[1] || 0 };
}

/**
 * Concatenate sections into one master by STREAM-COPY (no re-encode), so
 * every unchanged section stays bit-identical to its stored file — zero
 * quality loss per edit. Stream-copy concat requires uniform codec params
 * (sample rate + channels), so any section that isn't canonical (44100
 * stereo) is re-encoded to canonical first; matching sections are copied
 * untouched. A fixed silence gap is inserted between sections.
 */
async function robustConcat(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length === 0) throw new Error("No hay secciones para concatenar");
  const dir = mkdtempSync(join(tmpdir(), "rebuild-"));
  try {
    const silPath = join(dir, "sil.mp3");
    await runFfmpeg([
      "-y", "-loglevel", "error", "-f", "lavfi", "-i",
      `anullsrc=r=44100:cl=stereo`, "-t", String(GAP_SEC), "-c:a", "libmp3lame", "-b:a", "128k", silPath,
    ]);
    const lines: string[] = [];
    const ref = (p: string) => lines.push(`file '${p.replace(/'/g, "'\\''")}'`);
    for (let i = 0; i < buffers.length; i += 1) {
      let segPath = join(dir, `s${i}.mp3`);
      writeFileSync(segPath, buffers[i]);
      const fmt = ffprobeFormat(segPath);
      if (fmt.sampleRate !== 44100 || fmt.channels !== 2) {
        // Non-canonical → re-encode just this one so stream-copy concat
        // never drops/garbles it (the bug that truncated the master).
        const fixed = join(dir, `s${i}_fix.mp3`);
        await runFfmpeg([
          "-y", "-loglevel", "error", "-i", segPath,
          "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", MASTER_BITRATE, fixed,
        ]);
        segPath = fixed;
      }
      ref(segPath);
      if (i < buffers.length - 1) ref(silPath);
    }
    const listPath = join(dir, "list.txt");
    writeFileSync(listPath, lines.join("\n"));
    const outPath = join(dir, "out.mp3");
    await runFfmpeg([
      "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath,
    ]);
    return readFileSync(outPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Section-based audio editing. Multi-voice stories generated with the
 * fragment pipeline keep EACH section's standalone audio (its individual
 * TTS take) in `audioFragments[i].url`. To replace one section we swap
 * that buffer and re-concat the master from the sections — no
 * time-splicing, no aeneas offsets, no drift.
 *
 * `prevUrl` holds the section's previous take so the editor can revert a
 * single section to the version before the last regenerate/upload.
 */

export type StoredFragment = {
  index: number;
  speaker: string;
  voiceId: string;
  startSec: number;
  endSec: number;
  url: string;
  text: string;
  prevUrl?: string | null;
};

export function coerceFragments(value: unknown): StoredFragment[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: StoredFragment[] = [];
  for (const f of value as Array<Record<string, unknown>>) {
    if (typeof f?.url !== "string" || !f.url) return null; // every section must have audio
    out.push({
      index: typeof f.index === "number" ? f.index : out.length,
      speaker: typeof f.speaker === "string" ? f.speaker : "narrator",
      voiceId: typeof f.voiceId === "string" ? f.voiceId : "",
      startSec: typeof f.startSec === "number" ? f.startSec : 0,
      endSec: typeof f.endSec === "number" ? f.endSec : 0,
      url: f.url,
      text: typeof f.text === "string" ? f.text : "",
      prevUrl: typeof f.prevUrl === "string" ? f.prevUrl : null,
    });
  }
  return out;
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Descarga de sección falló: HTTP ${res.status} (${url})`);
  return Buffer.from(await res.arrayBuffer());
}

type SectionResult = { audioUrl: string; sectionUrl: string; prevSectionUrl: string | null };

/**
 * Download every section, rebuild + upload the master, and persist the
 * updated fragments + audioUrl. Returns the new master + the changed
 * section's url/prevUrl.
 */
async function rebuildAndPersist(args: {
  storyId: string;
  slug: string | null;
  audioFilename: string | null;
  frags: StoredFragment[];
  changedIndex: number;
  /** A buffer already in hand for `changedIndex` (avoids re-downloading it). */
  changedBuffer?: Buffer;
}): Promise<SectionResult> {
  const { frags, changedIndex } = args;
  const buffers = await Promise.all(
    frags.map((f, i) =>
      i === changedIndex && args.changedBuffer ? Promise.resolve(args.changedBuffer) : download(f.url),
    ),
  );
  const base = (args.audioFilename ?? `${args.slug}.mp3`)
    .replace(/\.mp3$/, "")
    .replace(/_multivoice.*$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const ts = Date.now();
  const master = await robustConcat(buffers);
  const masterName = `${base}_multivoice_${ts}.mp3`;
  const masterUpload = await uploadPublicObject({
    key: `media/generated/audio/${masterName}`,
    body: master,
    contentType: "audio/mpeg",
  });
  if (!masterUpload?.url) throw new Error("Subida del master a R2 falló");

  await prisma.journeyStory.update({
    where: { id: args.storyId },
    data: {
      audioUrl: masterUpload.url,
      audioFilename: masterName,
      audioStatus: "ready",
      audioFragments: frags as unknown as object,
    },
  });

  const changed = frags[changedIndex];
  return { audioUrl: masterUpload.url, sectionUrl: changed?.url ?? "", prevSectionUrl: changed?.prevUrl ?? null };
}

/**
 * Re-concatenate the master from the story's CURRENT sections (no section
 * change). Used to repair a master, or after a concat-logic fix.
 */
export async function rebuildMasterForStory(storyId: string): Promise<{ audioUrl: string }> {
  const { story, frags } = await loadFragsForStory(storyId);
  const r = await rebuildAndPersist({
    storyId,
    slug: story.slug,
    audioFilename: story.audioFilename,
    frags,
    changedIndex: -1,
  });
  return { audioUrl: r.audioUrl };
}

async function loadFragsForStory(storyId: string) {
  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: { id: true, slug: true, audioFilename: true, audioUrl: true, audioFragments: true },
  });
  if (!story) throw new Error("Historia no encontrada");
  if (!story.audioUrl) throw new Error("La historia no tiene master todavía");
  const frags = coerceFragments(story.audioFragments);
  if (!frags) throw new Error("La historia no tiene secciones guardadas (regenera el audio completo primero)");
  return { story, frags };
}

function ffprobeDurationFile(path: string): number {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path]);
  return parseFloat((r.stdout?.toString() ?? "0").trim()) || 0;
}

/**
 * IN-PLACE splice: replace the [startSec, endSec] span of the master with
 * `sectionBuffer` using a HARD cut (no crossfade) at the boundaries —
 * which sit inside the inter-section silence, so the cut is clean. Unlike
 * rebuilding from sections, this leaves the rest of the master untouched:
 * original pacing/pauses preserved, no tight-boundary clipping, only the
 * edited span changes. One re-encode (filter requires decode), at a clean
 * bitrate. aformat unifies streams so concat never glitches.
 */
async function spliceInPlace(masterBuffer: Buffer, sectionBuffer: Buffer, startSec: number, endSec: number): Promise<Buffer> {
  const dir = mkdtempSync(join(tmpdir(), "splice-"));
  try {
    const masterPath = join(dir, "m.mp3");
    const segPath = join(dir, "seg.mp3");
    const outPath = join(dir, "out.mp3");
    writeFileSync(masterPath, masterBuffer);
    writeFileSync(segPath, sectionBuffer);
    const masterDur = ffprobeDurationFile(masterPath);
    const hasBefore = startSec > 0.02;
    const hasAfter = endSec < masterDur - 0.02;
    const NORM = "aformat=channel_layouts=stereo:sample_rates=44100:sample_fmts=fltp";
    const parts: string[] = [];
    const order: string[] = [];
    if (hasBefore) { parts.push(`[0:a]atrim=0:${startSec.toFixed(3)},asetpts=PTS-STARTPTS,${NORM}[before]`); order.push("[before]"); }
    parts.push(`[1:a]${NORM}[seg]`); order.push("[seg]");
    if (hasAfter) { parts.push(`[0:a]atrim=${endSec.toFixed(3)},asetpts=PTS-STARTPTS,${NORM}[after]`); order.push("[after]"); }
    const filter = parts.join(";") + `;${order.join("")}concat=n=${order.length}:v=0:a=1[out]`;
    await runFfmpeg([
      "-y", "-loglevel", "error", "-i", masterPath, "-i", segPath,
      "-filter_complex", filter, "-map", "[out]",
      "-c:a", "libmp3lame", "-b:a", MASTER_BITRATE, outPath,
    ]);
    return readFileSync(outPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Shared core: splice `sectionBuffer` into the master at fragment i's
 * span, persist the new master + the updated fragment (url, prevUrl,
 * text, new endSec), and shift every later fragment by the duration delta
 * so their boundaries stay aligned with the new master.
 */
async function applyInPlace(args: {
  story: { id: string; slug: string | null; audioFilename: string | null; audioUrl: string | null };
  frags: StoredFragment[];
  fragmentIndex: number;
  sectionBuffer: Buffer;
  newUrl: string;
  newPrevUrl: string | null;
  newText?: string;
  /** Vercel-only: loudnorm the section inside the Modal splice (the local
   *  path pre-normalizes before calling this, so it passes false). */
  loudnorm?: boolean;
}): Promise<SectionResult> {
  const { story, frags, fragmentIndex, sectionBuffer } = args;
  const frag = frags[fragmentIndex];
  const base = (story.audioFilename ?? `${story.slug}.mp3`).replace(/\.mp3$/, "").replace(/_multivoice.*$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const masterName = `${base}_multivoice_${Date.now()}.mp3`;

  let newMasterUrl: string;
  let newDur: number;
  if (process.env.VERCEL) {
    // No ffmpeg on Vercel → hard-cut splice on Modal (crossfadeSec: 0 keeps
    // boundaries exact, matching the local spliceInPlace), and use the
    // returned segment duration to shift later fragments.
    const r = await spliceOnModal({
      masterUrl: story.audioUrl!,
      fragment: sectionBuffer,
      startSec: frag.startSec,
      endSec: frag.endSec,
      filename: masterName,
      process: args.loudnorm ? { loudnorm: true } : null,
      crossfadeSec: 0,
    });
    if (r.segDurationSec == null) {
      throw new Error("El servidor de audio (Modal) no devolvió segDurationSec — redeploya audio_studio.py");
    }
    newMasterUrl = r.url;
    newDur = r.segDurationSec;
  } else {
    const newMaster = await spliceInPlace(Buffer.from(await download(story.audioUrl!)), sectionBuffer, frag.startSec, frag.endSec);
    const tmp = mkdtempSync(join(tmpdir(), "dur-"));
    try { const p = join(tmp, "s.mp3"); writeFileSync(p, sectionBuffer); newDur = ffprobeDurationFile(p); } finally { rmSync(tmp, { recursive: true, force: true }); }
    const up = await uploadPublicObject({ key: `media/generated/audio/${masterName}`, body: newMaster, contentType: "audio/mpeg" });
    if (!up?.url) throw new Error("Subida del master a R2 falló");
    newMasterUrl = up.url;
  }

  const delta = newDur - (frag.endSec - frag.startSec);
  frags[fragmentIndex] = { ...frag, url: args.newUrl, prevUrl: args.newPrevUrl, text: args.newText ?? frag.text, endSec: frag.startSec + newDur };
  for (let k = fragmentIndex + 1; k < frags.length; k += 1) {
    frags[k] = { ...frags[k], startSec: Number((frags[k].startSec + delta).toFixed(3)), endSec: Number((frags[k].endSec + delta).toFixed(3)) };
  }

  await prisma.journeyStory.update({ where: { id: story.id }, data: { audioUrl: newMasterUrl, audioFilename: masterName, audioStatus: "ready", audioFragments: frags as unknown as object } });
  return { audioUrl: newMasterUrl, sectionUrl: args.newUrl, prevSectionUrl: args.newPrevUrl };
}

/**
 * Replace section `fragmentIndex` with `newSectionBuffer`, keeping the
 * previous take as `prevUrl` so it can be reverted. Rebuilds + persists.
 */
export async function replaceSectionAndRebuild(args: {
  storyId: string;
  fragmentIndex: number;
  newSectionBuffer: Buffer;
  newText?: string;
  /** Loudness-normalize the section before storing. ON for fresh TTS
   *  (ElevenLabs output, esp. v3, runs hot/clips); OFF for an operator's
   *  already-mastered manual upload. */
  normalizeSection?: boolean;
}): Promise<SectionResult> {
  const { story, frags } = await loadFragsForStory(args.storyId);
  if (args.fragmentIndex < 0 || args.fragmentIndex >= frags.length) {
    throw new Error(`fragmentIndex fuera de rango (0..${frags.length - 1})`);
  }
  // Loudnorm a fresh TTS take. Locally we pre-normalize here (ffmpeg); on
  // Vercel there's no ffmpeg, so we defer the loudnorm to the Modal splice
  // (applyInPlace passes loudnorm:true) and store the raw section.
  const loudnormOnSplice = !!args.normalizeSection && !!process.env.VERCEL;
  const sectionBuffer = args.normalizeSection && !process.env.VERCEL
    ? await normalizeSectionAudio(args.newSectionBuffer)
    : args.newSectionBuffer;
  const base = (story.audioFilename ?? `${story.slug}.mp3`)
    .replace(/\.mp3$/, "")
    .replace(/_multivoice.*$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const secUpload = await uploadPublicObject({
    key: `media/generated/audio/sections/${base}_sec${String(args.fragmentIndex).padStart(2, "0")}_re${Date.now()}.mp3`,
    body: sectionBuffer,
    contentType: "audio/mpeg",
  });
  if (!secUpload?.url) throw new Error("Subida de la sección a R2 falló");

  const old = frags[args.fragmentIndex];
  return applyInPlace({
    story,
    frags,
    fragmentIndex: args.fragmentIndex,
    sectionBuffer,
    newUrl: secUpload.url,
    newPrevUrl: old.url, // the take we're replacing → revert target
    newText: args.newText,
    loudnorm: loudnormOnSplice,
  });
}

/**
 * Revert section `fragmentIndex` to its `prevUrl` (the take before the
 * last replace). Swaps url↔prevUrl so the user can toggle back and forth.
 */
export async function revertSection(args: {
  storyId: string;
  fragmentIndex: number;
}): Promise<SectionResult> {
  const { story, frags } = await loadFragsForStory(args.storyId);
  const f = frags[args.fragmentIndex];
  if (!f) throw new Error("Sección no encontrada");
  if (!f.prevUrl) throw new Error("Esta sección no tiene versión anterior");
  // Splice the previous take back in; swap url↔prevUrl so it's toggleable.
  const prevBuffer = await download(f.prevUrl);
  return applyInPlace({
    story,
    frags,
    fragmentIndex: args.fragmentIndex,
    sectionBuffer: prevBuffer,
    newUrl: f.prevUrl,
    newPrevUrl: f.url,
  });
}
