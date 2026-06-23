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
import { DEFAULT_AMBIENT_VOLUME, DEFAULT_NARRATION_TEMPO, parseDialogueSegments } from "@/lib/elevenlabs";
import { coerceAudioSegments } from "@/lib/audioSegments";

// A sentence segment that opens with "Name: " is a spoken character turn;
// continuation sentences of the same turn carry no label, so speaker is
// resolved by aligning sentence segments against the turn sequence below.
const SPEAKER_LABEL_RE = /^([\p{Lu}][\p{L}]+):\s/u;
const normTokens = (s: string): string[] =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

/**
 * Narrator time ranges, used to silence the ambient bed while the
 * (out-of-scene) narrator speaks — characters are in the scene, the narrator
 * is voice-over, so the bed only plays under dialogue. See memory
 * `feedback_ambient_not_under_narrator`.
 *
 * Returns the ranges in the `audioSegments` timeline plus `span` (the last
 * segment end). Callers scale to whatever timeline they mix into by
 * multiplying by `targetDuration / span` (see `buildAmbientStage`); this
 * auto-corrects any uniform stretch (e.g. atempo) without assuming a factor.
 * Returns `{ intervals: [], span: 0 }` when the inputs can't be trusted (no
 * segments / no parsable turns) — callers then mix the bed continuously.
 */
export function computeNarratorOffIntervals(
  storyText: string,
  segmentsRaw: unknown
): { intervals: [number, number][]; span: number } {
  const segs = coerceAudioSegments(segmentsRaw)
    .filter((s) => Number.isFinite(s.startSec) && Number.isFinite(s.endSec))
    .sort((a, b) => a.startSec - b.startSec);
  if (segs.length === 0) return { intervals: [], span: 0 };
  const turns = parseDialogueSegments(storyText).map((t) => ({
    speaker: t.speaker,
    tokenCount: normTokens(t.text).length,
  }));
  if (turns.length === 0) return { intervals: [], span: 0 };

  let ti = 0;
  let consumed = 0;
  const off: [number, number][] = [];
  for (const seg of segs) {
    const txt = (seg.text ?? "").trim();
    const m = txt.match(SPEAKER_LABEL_RE);
    const segTokenCount = normTokens(m ? txt.slice(m[0].length) : txt).length;
    if (m) {
      // A labeled sentence snaps the cursor to that speaker's next turn.
      const name = m[1].toLowerCase();
      let j = ti;
      while (j < turns.length && turns[j].speaker.toLowerCase() !== name) j += 1;
      if (j < turns.length) {
        ti = j;
        consumed = 0;
      }
    }
    const speaker = turns[ti]?.speaker ?? "narrator";
    if (speaker.toLowerCase() === "narrator") {
      const last = off[off.length - 1];
      if (last && seg.startSec - last[1] <= 0.5) last[1] = seg.endSec;
      else off.push([seg.startSec, seg.endSec]);
    }
    consumed += segTokenCount;
    if (turns[ti] && consumed >= turns[ti].tokenCount) {
      ti = Math.min(ti + 1, turns.length - 1);
      consumed = 0;
    }
  }

  // The title is narrated VO before the first body segment → silence too.
  const firstStart = segs[0].startSec;
  if (off.length && off[0][0] <= firstStart + 0.1) off[0][0] = 0;
  else if (firstStart > 0.05) off.unshift([0, firstStart]);

  const span = segs[segs.length - 1].endSec;
  return { intervals: off, span };
}

/**
 * Build the ffmpeg ambient stage `[<inLabel>]...[<outLabel>]` that silences
 * the bed during narrator ranges. `scale` maps the segment timeline to the
 * timeline being mixed (= targetDuration / span). Falls back to a continuous
 * mix (with a 1s fade-in) when there are no narrator ranges.
 */
export function buildAmbientStage(args: {
  inLabel: string;
  outLabel: string;
  volume: number;
  offIntervals: [number, number][];
  scale: number;
}): string {
  const { inLabel, outLabel, volume, offIntervals, scale } = args;
  if (offIntervals.length === 0 || !Number.isFinite(scale) || scale <= 0) {
    return `[${inLabel}]volume=${volume},afade=t=in:st=0:d=1[${outLabel}]`;
  }
  const offExpr = offIntervals
    .map(([a, b]) => `between(t,${(a * scale).toFixed(3)},${(b * scale).toFixed(3)})`)
    .join("+");
  return `[${inLabel}]volume='${volume}*(1-min(1,${offExpr}))':eval=frame[${outLabel}]`;
}

const AVAILABLE_AMBIENTS = ["mercado", "metro", "restaurante", "bar", "cafeteria", "puerto", "playa", "parque", "calle", "cocina", "lluvia"] as const;
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
  /** Explicit narrator off-intervals (seconds, in the source/mixed timeline at
   *  tempo=1) to silence the bed. When provided, bypasses the drift-prone
   *  re-derivation from re-aligned `audioSegments` — pass the generator's exact
   *  per-fragment offsets instead. Assumes tempo=1 (scale stays 1/tempo=1). */
  narratorOffIntervals?: [number, number][];
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
      // Silence the bed while the narrator (out-of-scene VO) speaks; play it
      // continuously under character dialogue. The segments are aligned to the
      // pre-tempo source, atempo stretches by 1/tempo, so scale = 1/tempo.
      const { intervals } = args.narratorOffIntervals
        ? { intervals: args.narratorOffIntervals }
        : computeNarratorOffIntervals(story.text ?? "", story.audioSegments);
      if (intervals.length === 0) {
        console.warn(
          `[narrationPostProcess] could not resolve narrator ranges for ${args.storyId}; mixing ambient continuously`
        );
      }
      const ambientStage = buildAmbientStage({
        inLabel: "1:a",
        outLabel: "a1",
        volume: ambientVolume,
        offIntervals: intervals,
        scale: 1 / tempo,
      });
      const filter =
        `[0:a]atempo=${tempo}[s];` +
        `${ambientStage};` +
        `[s][a1]amix=inputs=2:duration=first:dropout_transition=2[mix];` +
        // No dynaudnorm here: the voice track is already loudness-normalized
        // (-16 LUFS) before this stage, and a dynamic normalizer on the
        // voice+bed MIX rides the gain with the voice loudness, making the
        // ambient bed audibly pump up/down ("breathe"). A single static-ish
        // loudnorm to target is enough; the bed stays at its fixed level.
        `[mix]loudnorm=I=-16:LRA=11:TP=-1.5`;
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
