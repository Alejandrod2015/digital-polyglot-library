/**
 * Pre-cut every aeneas-aligned `audioSegments[i]` of a story into its own
 * mp3 file in R2. The mobile practice player already prefers `clipUrl`
 * over `positionMillis` seeking, so once each segment has a clipUrl it
 * plays the small file end-to-end with NO drift, NO race, NO trim.
 *
 * Why ffmpeg from the existing mp3 instead of new ElevenLabs calls:
 *   - $0 incremental cost (mp3 already paid for and cached on R2).
 *   - The cut boundaries are the same aeneas timings, so the result
 *     matches what the karaoke reader already aligns to.
 *
 * One file per segment lives at:
 *   media/practice-clips/<storyId>/<segmentId>-v1.mp3
 *
 * v1 in the path lets us bump the version if we ever change cut params.
 */

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AudioSegment } from "@/lib/audioSegments";
import { getPublicObjectUrl, uploadPublicObject } from "@/lib/objectStorage";

const CLIP_VERSION = "v1";

export type ClipCutResult = {
  segmentId: string;
  clipUrl: string;
  bytes: number;
};

export async function cutSegmentClipsForStory(args: {
  storyId: string;
  audioUrl: string;
  segments: AudioSegment[];
  /** Force re-upload even if the public URL already resolves. */
  force?: boolean;
}): Promise<{
  cuts: ClipCutResult[];
  segments: AudioSegment[];
  skipped: number;
  failed: number;
}> {
  if (args.segments.length === 0) {
    return { cuts: [], segments: args.segments, skipped: 0, failed: 0 };
  }

  // Download the source mp3 once, write to tmp.
  const dir = await mkdtemp(join(tmpdir(), `clipcut-${args.storyId}-`));
  const sourcePath = join(dir, "source.mp3");

  try {
    const res = await fetch(args.audioUrl);
    if (!res.ok) {
      throw new Error(`Source mp3 fetch failed (${res.status}) ${args.audioUrl}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(sourcePath, buf);

    const cuts: ClipCutResult[] = [];
    let skipped = 0;
    let failed = 0;
    const updatedSegments: AudioSegment[] = [];

    for (const segment of args.segments) {
      if (!segment.id || !Number.isFinite(segment.startSec) || !Number.isFinite(segment.endSec) || segment.endSec <= segment.startSec) {
        updatedSegments.push(segment);
        failed += 1;
        continue;
      }
      const key = `media/practice-clips/${args.storyId}/${segment.id}-${CLIP_VERSION}.mp3`;
      const existingUrl = getPublicObjectUrl(key);
      if (!args.force && existingUrl) {
        // Probe HEAD: if it already exists in R2, reuse.
        const head = await fetch(existingUrl, { method: "HEAD" }).catch(() => null);
        if (head?.ok) {
          updatedSegments.push({ ...segment, clipUrl: existingUrl });
          skipped += 1;
          continue;
        }
      }

      try {
        const clipBuf = await ffmpegCutMp3({
          sourcePath,
          startSec: segment.startSec,
          endSec: segment.endSec,
          tmpDir: dir,
          segmentId: segment.id,
        });
        const upload = await uploadPublicObject({
          key,
          body: clipBuf,
          contentType: "audio/mpeg",
        });
        const url = upload?.url ?? getPublicObjectUrl(key);
        if (!url) {
          updatedSegments.push(segment);
          failed += 1;
          continue;
        }
        updatedSegments.push({ ...segment, clipUrl: url });
        cuts.push({ segmentId: segment.id, clipUrl: url, bytes: clipBuf.byteLength });
      } catch (err) {
        console.warn(`[clip-cutter] ${args.storyId}/${segment.id} failed:`, err instanceof Error ? err.message : err);
        updatedSegments.push(segment);
        failed += 1;
      }
    }

    return { cuts, segments: updatedSegments, skipped, failed };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function ffmpegCutMp3(args: {
  sourcePath: string;
  startSec: number;
  endSec: number;
  tmpDir: string;
  segmentId: string;
}): Promise<Buffer> {
  const outPath = join(args.tmpDir, `${args.segmentId}.mp3`);
  const duration = Math.max(0.05, args.endSec - args.startSec);
  // Stream copy is preferred (no re-encode) but seeking inside a CBR mp3
  // by `-ss` after `-i` keeps the cut frame-accurate enough for sentence
  // boundaries (~26 ms keyframe granularity for typical mp3).
  // We use `-c copy` to keep the original quality and stay fast.
  const argv = [
    "-y",
    "-loglevel",
    "error",
    "-i",
    args.sourcePath,
    "-ss",
    args.startSec.toFixed(3),
    "-t",
    duration.toFixed(3),
    "-c",
    "copy",
    outPath,
  ];

  await runCommand("ffmpeg", argv);
  return readFile(outPath);
}

function runCommand(cmd: string, argv: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argv, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 400)}`));
    });
  });
}
