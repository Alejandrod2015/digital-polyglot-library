/**
 * Narration post-processing applied to every published JourneyStory audio
 * after the TTS engine renders it.
 *
 * Two effects, both transparent to the engine that produced the source mp3:
 *   1. Time-stretch via ffmpeg `atempo` (preserves pitch). Default
 *      `DEFAULT_NARRATION_TEMPO` from `@/lib/elevenlabs`.
 *   2. Mix a looping ambient bed underneath at `DEFAULT_AMBIENT_VOLUME`
 *      when the story has `ambientTag` set.
 *
 * Always followed by aeneas re-alignment so word timings match the
 * stretched waveform; without this, the karaoke highlight runs ahead of
 * the audio.
 *
 * The source mp3 is left in R2 untouched and a new timestamped file
 * replaces it in the DB, so any change is reversible.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";
import { uploadPublicObject } from "@/lib/objectStorage";
import { generateWordTimingsForStory } from "@/lib/audioWordTimings";
import { DEFAULT_AMBIENT_VOLUME, DEFAULT_NARRATION_TEMPO } from "@/lib/elevenlabs";

const AVAILABLE_AMBIENTS = ["mercado", "metro", "restaurante", "bar", "cafeteria", "puerto", "playa", "parque", "calle"] as const;
export type AmbientTag = (typeof AVAILABLE_AMBIENTS)[number];

const LANGUAGE_TO_AMBIENT_SUFFIX: Record<string, string> = {
  spanish: "es", german: "de", english: "en",
  french: "fr", italian: "it", portuguese: "pt",
};

function resolveAmbientPath(tag: string | null | undefined, language: string | null | undefined): string | null {
  if (!tag) return null;
  if (!AVAILABLE_AMBIENTS.includes(tag as AmbientTag)) return null;
  const dir = join(process.cwd(), "scripts", "tts", "ambience");
  const suffix = language ? LANGUAGE_TO_AMBIENT_SUFFIX[language.toLowerCase()] : null;
  if (suffix) {
    const localized = join(dir, `${tag}_${suffix}.mp3`);
    if (existsSync(localized)) return localized;
  }
  const generic = join(dir, `${tag}.mp3`);
  return existsSync(generic) ? generic : null;
}

async function downloadToBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed ${r.status} for ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (c) => { stderr += c.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 400)}`));
    });
  });
}

export type ApplyNarrationPostProcessArgs = {
  storyId: string;
  /** Override the source mp3 URL (defaults to the story's current audioUrl).
   *  Use this when iterating on tempo to avoid compounding atempo passes
   *  on top of an already-stretched file. */
  sourceUrl?: string;
  /** Speed multiplier (preserves pitch). Default: DEFAULT_NARRATION_TEMPO. */
  tempo?: number;
  /** Ambient tag override. By default uses the story's `ambientTag` column. */
  ambientTag?: string | null;
  /** Ambient bed volume. Default: DEFAULT_AMBIENT_VOLUME. */
  ambientVolume?: number;
  /** Skip aeneas re-alignment (useful when caller plans to align later). */
  skipAlignment?: boolean;
};

export type ApplyNarrationPostProcessResult = {
  audioUrl: string;
  audioFilename: string;
  appliedTempo: number;
  appliedAmbientTag: string | null;
};

/**
 * Apply the catalog-wide narration post-processing to a story's audio.
 * Idempotent at the file level (always produces a fresh timestamped mp3),
 * but compound if the same source URL is passed twice in a row — pass an
 * explicit `sourceUrl` pointing at the original (pre-stretch) file when
 * iterating.
 */
export async function applyNarrationPostProcess(
  args: ApplyNarrationPostProcessArgs
): Promise<ApplyNarrationPostProcessResult> {
  const story = await prisma.journeyStory.findUnique({
    where: { id: args.storyId },
    include: { journey: true },
  });
  if (!story) throw new Error(`Story not found: ${args.storyId}`);
  if (!story.slug) throw new Error(`Story ${args.storyId} has no slug`);

  const sourceUrl = args.sourceUrl ?? story.audioUrl;
  if (!sourceUrl) throw new Error(`Story ${args.storyId} has no source audio to post-process`);

  const tempo = args.tempo ?? DEFAULT_NARRATION_TEMPO;
  if (!Number.isFinite(tempo) || tempo < 0.5 || tempo > 2.0) {
    throw new Error(`tempo must be in [0.5, 2.0], got ${tempo}`);
  }

  const ambientTag = args.ambientTag !== undefined ? args.ambientTag : story.ambientTag;
  const ambientVolume = args.ambientVolume ?? DEFAULT_AMBIENT_VOLUME;
  const ambientFile = resolveAmbientPath(ambientTag, story.journey.language);

  const workDir = mkdtempSync(join(tmpdir(), `narration-${args.storyId}-`));
  const inPath = join(workDir, "in.mp3");
  const outPath = join(workDir, "out.mp3");

  try {
    const buf = await downloadToBuffer(sourceUrl);
    writeFileSync(inPath, buf);

    const ffmpegArgs = ["-y", "-loglevel", "error", "-i", inPath];
    if (ambientFile) {
      ffmpegArgs.push("-stream_loop", "-1", "-i", ambientFile);
      const filter =
        `[0:a]atempo=${tempo}[s];` +
        `[1:a]volume=${ambientVolume},afade=t=in:st=0:d=1[a1];` +
        `[s][a1]amix=inputs=2:duration=first:dropout_transition=2[mix];` +
        `[mix]dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5`;
      ffmpegArgs.push("-filter_complex", filter);
    } else {
      ffmpegArgs.push("-af", `atempo=${tempo},loudnorm=I=-16:LRA=11:TP=-1.5`);
    }
    ffmpegArgs.push("-codec:a", "libmp3lame", "-b:a", "128k", outPath);
    await runFfmpeg(ffmpegArgs);

    const processed = readFileSync(outPath);
    const baseName = (story.audioFilename ?? `${story.slug}.mp3`)
      .replace(/\.mp3$/, "")
      .replace(/_atempo[\d.]+_\d+$/, "");
    const newFilename = `${baseName}_atempo${tempo}_${Date.now()}.mp3`;
    const uploaded = await uploadPublicObject({
      key: `media/generated/audio/${newFilename}`,
      body: processed,
      contentType: "audio/mpeg",
    });
    if (!uploaded?.url) throw new Error("R2 upload failed");

    await prisma.journeyStory.update({
      where: { id: args.storyId },
      data: {
        audioUrl: uploaded.url,
        audioFilename: newFilename,
        audioStatus: "ready",
        ...(ambientTag !== story.ambientTag ? { ambientTag } : {}),
      },
    });

    if (!args.skipAlignment) {
      try {
        await generateWordTimingsForStory(args.storyId);
      } catch (err) {
        console.warn(
          `[narrationPostProcess] aeneas alignment failed for ${args.storyId}: ${err instanceof Error ? err.message : err}`
        );
      }
    }

    return {
      audioUrl: uploaded.url,
      audioFilename: newFilename,
      appliedTempo: tempo,
      appliedAmbientTag: ambientTag,
    };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
