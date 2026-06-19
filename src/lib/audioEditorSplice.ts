import "server-only";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { uploadPublicObject } from "@/lib/objectStorage";

// Crossfade at each splice seam — matches CROSSFADE_SEC in preview-segment
// and SPLICE_CROSSFADE_SEC in the Modal endpoint so every splice sounds alike.
export const CROSSFADE_SEC = 0.2;

// Extra ffmpeg audio filter applied to the inserted segment BEFORE the
// splice. Used by the regenerate flow so a freshly-synthesized segment
// matches the master's narration profile (tempo + loudness). null = the
// segment is inserted as-is (manual upload: operator already mastered it).
export type SegmentProcess = { tempo?: number; loudnorm?: boolean } | null;

function segPrefilter(process: SegmentProcess): string {
  if (!process) return "";
  const parts: string[] = [];
  if (process.tempo && process.tempo !== 1) parts.push(`atempo=${process.tempo}`);
  if (process.loudnorm) parts.push("loudnorm=I=-16:LRA=11:TP=-1.5");
  return parts.length ? parts.join(",") + "," : "";
}

/**
 * Resolve the Modal `splice_upload` endpoint URL (production path). Prefer
 * an explicit env var; otherwise derive from the synth URL by swapping the
 * function name (`splice_upload` → `splice-upload`).
 */
function resolveSpliceUrl(): string {
  const explicit = (process.env.STUDIO_AUDIO_SPLICE_URL || "").trim();
  if (explicit) return explicit;
  const synth = (process.env.STUDIO_AUDIO_URL || "").trim();
  if (synth.includes("-synthesize.modal.run")) {
    return synth.replace("-synthesize.modal.run", "-splice-upload.modal.run");
  }
  throw new Error(
    "Falta STUDIO_AUDIO_SPLICE_URL (y STUDIO_AUDIO_URL no tiene el formato synth esperado)",
  );
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (c) => { stderr += c.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 400)}`))));
  });
}

function ffprobeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", filePath,
    ]);
    let out = "";
    let err = "";
    proc.stdout.on("data", (c) => { out += c.toString(); });
    proc.stderr.on("data", (c) => { err += c.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exit ${code}: ${err.slice(0, 200)}`));
      const n = parseFloat(out.trim());
      if (Number.isFinite(n)) resolve(n);
      else reject(new Error(`ffprobe returned non-numeric: ${out}`));
    });
  });
}

async function downloadToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Descarga del master falló: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Build the ffmpeg `-filter_complex` that replaces [startSec, endSec] of
 * input 0 (master) with input 1 (fragment), crossfading each retained
 * seam. Handles edges: when startSec≈0 there is no "before" (title
 * replacement), when endSec≈duration there is no "after".
 *
 * `segFilter` is an optional pre-filter applied to the inserted segment
 * (e.g. "atempo=0.94,loudnorm=...") so regenerated segments match the
 * master profile.
 */
function buildSpliceFilter(
  startSec: number,
  endSec: number,
  masterDur: number,
  segFilter: string,
): { filter: string; outLabel: string } {
  const NORM = "aformat=channel_layouts=stereo:sample_rates=44100:sample_fmts=fltp";
  const X = CROSSFADE_SEC;
  const hasBefore = startSec > X;
  const hasAfter = endSec < masterDur - X;
  const parts: string[] = [];
  if (hasBefore) parts.push(`[0:a]atrim=0:${startSec.toFixed(3)},asetpts=PTS-STARTPTS,${NORM}[before]`);
  if (hasAfter) parts.push(`[0:a]atrim=${endSec.toFixed(3)},asetpts=PTS-STARTPTS,${NORM}[after]`);
  parts.push(`[1:a]${segFilter}${NORM}[seg]`);

  if (hasBefore && hasAfter) {
    parts.push(`[before][seg]acrossfade=d=${X}:c1=tri:c2=tri[mid]`);
    parts.push(`[mid][after]acrossfade=d=${X}:c1=tri:c2=tri[out]`);
    return { filter: parts.join(";"), outLabel: "[out]" };
  }
  if (hasBefore) {
    parts.push(`[before][seg]acrossfade=d=${X}:c1=tri:c2=tri[out]`);
    return { filter: parts.join(";"), outLabel: "[out]" };
  }
  if (hasAfter) {
    parts.push(`[seg][after]acrossfade=d=${X}:c1=tri:c2=tri[out]`);
    return { filter: parts.join(";"), outLabel: "[out]" };
  }
  return { filter: parts.join(";"), outLabel: "[seg]" };
}

async function spliceLocally(args: {
  masterUrl: string;
  fragment: Buffer;
  startSec: number;
  endSec: number;
  process: SegmentProcess;
}): Promise<Buffer> {
  const { masterUrl, fragment, startSec, endSec } = args;
  const dir = mkdtempSync(join(tmpdir(), "audio-splice-"));
  const masterPath = join(dir, "master.mp3");
  const segPath = join(dir, "seg.mp3");
  const outPath = join(dir, "out.mp3");
  try {
    writeFileSync(masterPath, await downloadToBuffer(masterUrl));
    writeFileSync(segPath, fragment);

    const masterDur = await ffprobeDuration(masterPath);
    const segDur = await ffprobeDuration(segPath);
    if (endSec >= masterDur) {
      throw new Error(`endSec (${endSec.toFixed(2)}s) excede la duración del master (${masterDur.toFixed(2)}s)`);
    }
    const { filter, outLabel } = buildSpliceFilter(startSec, endSec, masterDur, segPrefilter(args.process));
    const seams = (startSec > CROSSFADE_SEC ? 1 : 0) + (endSec < masterDur - CROSSFADE_SEC ? 1 : 0);
    const minSeg = CROSSFADE_SEC * seams + 0.02;
    if (segDur < minSeg) {
      throw new Error(`El fragmento es muy corto (${segDur.toFixed(2)}s); mínimo ${minSeg.toFixed(2)}s para empalmar`);
    }
    await runFfmpeg([
      "-y", "-loglevel", "error",
      "-i", masterPath, "-i", segPath,
      "-filter_complex", filter,
      "-map", outLabel, "-codec:a", "libmp3lame", "-b:a", "128k", outPath,
    ]);
    return readFileSync(outPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Splice a segment into a master on Modal (Vercel has no ffmpeg). Pass
 * `crossfadeSec: 0` for a HARD cut (section editor: exact boundaries so the
 * caller can recompute offsets); omit it for the default smooth crossfade
 * (legacy time-splice upload). Returns `segDurationSec` when the Modal
 * endpoint provides it (deployed build), letting the section path shift
 * later fragments without a local ffprobe.
 */
export async function spliceOnModal(args: {
  masterUrl: string;
  fragment: Buffer;
  startSec: number;
  endSec: number;
  filename: string;
  process: SegmentProcess;
  crossfadeSec?: number;
}): Promise<{ url: string; filename: string; segDurationSec: number | null }> {
  const token = (process.env.STUDIO_AUDIO_TOKEN || "").trim();
  if (!token) throw new Error("STUDIO_AUDIO_TOKEN no configurado");
  const spliceUrl = resolveSpliceUrl();

  let res: Response;
  try {
    res = await fetch(spliceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        _token: token,
        audioUrl: args.masterUrl,
        segmentBase64: args.fragment.toString("base64"),
        startSec: args.startSec,
        endSec: args.endSec,
        filename: args.filename,
        segmentTempo: args.process?.tempo ?? null,
        segmentLoudnorm: !!args.process?.loudnorm,
        ...(args.crossfadeSec != null ? { crossfadeSec: args.crossfadeSec } : {}),
      }),
    });
  } catch (err) {
    throw new Error(`No se pudo contactar el servidor de audio (Modal): ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`El empalme en Modal falló (${res.status})${detail ? ` — ${detail.slice(0, 300)}` : ""}`);
  }
  const json = (await res.json()) as { url?: string; filename?: string; segDurationSec?: number };
  if (!json?.url) throw new Error("Modal no devolvió una URL de audio");
  return {
    url: json.url,
    filename: json.filename ?? args.filename,
    segDurationSec: typeof json.segDurationSec === "number" ? json.segDurationSec : null,
  };
}

/**
 * Splice `fragment` into the master at [startSec, endSec] and upload the
 * result to R2, returning its public URL + filename. Uses local ffmpeg
 * when this server has it, and offloads to Modal on Vercel (no ffmpeg).
 *
 * `process` optionally pre-conditions the segment (tempo/loudnorm) so a
 * regenerated segment matches the master; pass null for a pre-mastered
 * manual upload.
 */
export async function spliceFragmentIntoMaster(args: {
  masterUrl: string;
  fragment: Buffer;
  startSec: number;
  endSec: number;
  filename: string;
  process?: SegmentProcess;
}): Promise<{ url: string; filename: string }> {
  const process_ = args.process ?? null;
  if (process.env.VERCEL) {
    return spliceOnModal({ ...args, process: process_ });
  }
  const spliced = await spliceLocally({ ...args, process: process_ });
  const uploaded = await uploadPublicObject({
    key: `media/generated/audio/${args.filename}`,
    body: spliced,
    contentType: "audio/mpeg",
  });
  if (!uploaded?.url) throw new Error("Subida a R2 falló (storage no configurado)");
  return { url: uploaded.url, filename: args.filename };
}
