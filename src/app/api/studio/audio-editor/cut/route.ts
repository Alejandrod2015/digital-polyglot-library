import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";
import { uploadPublicObject } from "@/lib/objectStorage";
import { mergeVoiceProvenance, readVoiceProvenance } from "@/lib/voiceProvenance";

export const maxDuration = 120;

/**
 * POST /api/studio/audio-editor/cut
 *
 * Body: { storyId, startSec, endSec }
 *
 * Manual noise removal: splice OUT the [startSec, endSec] time region and
 * join the surrounding audio with a tiny crossfade to mask the seam click.
 * No TTS — purely surgical. Used by editors to delete clicks/pops/breaths
 * that regenerating the whole tramo wouldn't reliably fix.
 *
 * Non-destructive: writes audioUrlPreview (master stays intact until the
 * existing Promote/Discard flow runs). Cuts on top of an existing preview
 * chain (so several cuts accumulate). When the story carries a dry stem,
 * the same region is cut from it too, keeping the stem in lockstep with the
 * mixed master so future segment regenerations still splice cleanly.
 *
 * Word timings are NOT touched here — Promote re-runs aeneas alignment over
 * the new waveform, same as the regenerate flow.
 */

// `aformat` normalizes channels + sample rate + sample format so acrossfade
// can combine the two pieces (it is strict about layout matching).
const NORM = "aformat=channel_layouts=stereo:sample_rates=44100:sample_fmts=fltp";
// Short crossfade at the seam — long enough to kill the click, short enough
// not to audibly blur speech on either side of a noise.
const CUT_XFADE_SEC = 0.03;

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

function ffprobeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    let out = "";
    let err = "";
    proc.stdout.on("data", (c) => (out += c.toString()));
    proc.stderr.on("data", (c) => (err += c.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        const v = parseFloat(out.trim());
        if (Number.isFinite(v)) resolve(v);
        else reject(new Error(`ffprobe returned non-numeric: ${out}`));
      } else {
        reject(new Error(`ffprobe exit ${code}: ${err.slice(0, 200)}`));
      }
    });
  });
}

async function downloadToBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed ${r.status} for ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

/**
 * Build the ffmpeg filter that removes [startSec, endSec] from a single
 * input. Falls back to a plain head/tail trim when there is no room for a
 * crossfade on one side (cut touches the very start or very end).
 */
function buildCutFilter(startSec: number, endSec: number, durationSec: number): string {
  const s = startSec.toFixed(3);
  const e = endSec.toFixed(3);
  const headTooShort = startSec <= CUT_XFADE_SEC;
  const tailTooShort = endSec >= durationSec - CUT_XFADE_SEC;
  if (headTooShort && tailTooShort) {
    // Whole thing selected — nothing sensible to keep; caller validates
    // against this, but guard anyway by keeping the head.
    return `[0:a]atrim=0:${s},asetpts=PTS-STARTPTS,${NORM}[out]`;
  }
  if (headTooShort) {
    return `[0:a]atrim=${e},asetpts=PTS-STARTPTS,${NORM}[out]`;
  }
  if (tailTooShort) {
    return `[0:a]atrim=0:${s},asetpts=PTS-STARTPTS,${NORM}[out]`;
  }
  return [
    `[0:a]atrim=0:${s},asetpts=PTS-STARTPTS,${NORM}[before]`,
    `[0:a]atrim=${e},asetpts=PTS-STARTPTS,${NORM}[after]`,
    `[before][after]acrossfade=d=${CUT_XFADE_SEC}:c1=tri:c2=tri[out]`,
  ].join(";");
}

async function cutFile(srcPath: string, startSec: number, endSec: number, outPath: string) {
  const dur = await ffprobeDuration(srcPath);
  await runFfmpeg([
    "-y",
    "-loglevel",
    "error",
    "-i",
    srcPath,
    "-filter_complex",
    buildCutFilter(startSec, endSec, dur),
    "-map",
    "[out]",
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "128k",
    outPath,
  ]);
  return dur;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { storyId?: string; startSec?: number; endSec?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { storyId, startSec, endSec } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });
  if (
    typeof startSec !== "number" ||
    typeof endSec !== "number" ||
    !Number.isFinite(startSec) ||
    !Number.isFinite(endSec)
  ) {
    return NextResponse.json({ error: "startSec/endSec deben ser números" }, { status: 400 });
  }
  if (endSec - startSec < 0.02) {
    return NextResponse.json(
      { error: "El tramo a cortar es demasiado corto (mínimo 0.02s)." },
      { status: 400 },
    );
  }

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: {
      audioUrl: true,
      audioUrlPreview: true,
      audioFilename: true,
      slug: true,
      voiceProvenance: true,
    },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  // Cut on top of an existing preview chain so several cuts accumulate.
  const mixedSource = story.audioUrlPreview ?? story.audioUrl;
  if (!mixedSource) {
    return NextResponse.json({ error: "Story has no audio" }, { status: 400 });
  }
  const provenance = readVoiceProvenance(story.voiceProvenance);
  const drySource = provenance.previewDryUrl ?? provenance.dryUrl ?? null;

  const workDir = mkdtempSync(join(tmpdir(), `audio-cut-${storyId}-`));
  const mixedInPath = join(workDir, "mixed_in.mp3");
  const mixedOutPath = join(workDir, "mixed_out.mp3");
  const dryInPath = join(workDir, "dry_in.mp3");
  const dryOutPath = join(workDir, "dry_out.mp3");

  try {
    // ── Mixed master ──
    writeFileSync(mixedInPath, await downloadToBuffer(mixedSource));
    const mixedDuration = await ffprobeDuration(mixedInPath);
    if (endSec > mixedDuration) {
      return NextResponse.json(
        {
          error: `endSec (${endSec.toFixed(2)}s) excede la duración del audio (${mixedDuration.toFixed(2)}s).`,
        },
        { status: 400 },
      );
    }
    if (startSec <= CUT_XFADE_SEC && endSec >= mixedDuration - CUT_XFADE_SEC) {
      return NextResponse.json(
        { error: "El tramo cubre casi todo el audio; no queda nada que conservar." },
        { status: 400 },
      );
    }
    await cutFile(mixedInPath, startSec, endSec, mixedOutPath);

    const baseName = (story.audioFilename ?? `${story.slug}.mp3`)
      .replace(/\.mp3$/, "")
      .replace(/_(edit|cut)\d+$/, "");
    const newFilename = `${baseName}_cut${Date.now()}.mp3`;
    const uploaded = await uploadPublicObject({
      key: `media/generated/audio/${newFilename}`,
      body: readFileSync(mixedOutPath),
      contentType: "audio/mpeg",
    });
    if (!uploaded?.url) {
      return NextResponse.json({ error: "Upload R2 falló" }, { status: 500 });
    }

    // ── Dry stem (keep in lockstep when present) ──
    let updatedProvenance: object | null = null;
    if (drySource) {
      writeFileSync(dryInPath, await downloadToBuffer(drySource));
      await cutFile(dryInPath, startSec, endSec, dryOutPath);
      const newDryFilename = `${baseName}_cut${Date.now()}_dry.mp3`;
      const dryUpload = await uploadPublicObject({
        key: `media/generated/audio/${newDryFilename}`,
        body: readFileSync(dryOutPath),
        contentType: "audio/mpeg",
      });
      if (dryUpload?.url) {
        updatedProvenance = mergeVoiceProvenance(story.voiceProvenance, {
          previewDryUrl: dryUpload.url,
          previewDryFilename: newDryFilename,
        }) as unknown as object;
      }
    }

    await prisma.journeyStory.update({
      where: { id: storyId },
      data: {
        audioUrlPreview: uploaded.url,
        audioFilenamePreview: newFilename,
        ...(updatedProvenance ? { voiceProvenance: updatedProvenance } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      audioUrlPreview: uploaded.url,
      audioFilenamePreview: newFilename,
      removedSec: endSec - startSec,
      dryStemCut: !!drySource,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cut pipeline failed" },
      { status: 500 },
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
