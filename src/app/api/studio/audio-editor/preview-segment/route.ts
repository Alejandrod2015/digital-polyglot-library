import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";
import {
  DEFAULT_AMBIENT_VOLUME,
  DEFAULT_NARRATION_TEMPO,
  DEFAULT_VOICE_SETTINGS,
  softenPunctuationForTts,
} from "@/lib/elevenlabs";
import { uploadPublicObject } from "@/lib/objectStorage";
import { deriveAudioEditorBlocks, findBlockForChar } from "@/lib/audioEditorBlocks";
import { mergeVoiceProvenance, readVoiceProvenance } from "@/lib/voiceProvenance";
import { computeNarratorOffIntervals, buildAmbientStage } from "@/lib/narrationPostProcess";

export const maxDuration = 300;

/**
 * POST /api/studio/audio-editor/preview-segment
 *
 * Body: { storyId, startSec, endSec, charStart, charEnd }
 *
 * Pipeline:
 *  1. Validate story + sources.
 *  2. Extract text slice [charStart..charEnd] from storyPlainText.
 *  3. Branch by voice engine:
 *     - `elevenlabs/...` → call ElevenLabs API + apply atempo + ambient mix
 *       via local ffmpeg (legacy path).
 *     - everything else (`piper/`, `kokoro/`, `qwen/`, `qwen17/`, `f5/`,
 *       `chatterbox/`, etc.) → spawn the local Python TTS subprocess
 *       (scripts/tts/generate_audio.py) which handles its own postprocess +
 *       sidechain-ducked ambient mix, matching what the master used.
 *       Requires LOCAL_TTS_ENABLED=1 and a working .venv.
 *  4. Splice the processed segment into the master via ffmpeg with 80ms
 *     crossfades at both seams. Crossfade masks the ambient phase
 *     discontinuity.
 *  5. Upload as audioUrlPreview (non-destructive: master stays intact).
 */

const AVAILABLE_AMBIENTS = [
  "mercado",
  "metro",
  "restaurante",
  "bar",
  "cafeteria",
  "puerto",
  "playa",
  "parque",
  "calle",
  "lluvia",
] as const;
type AmbientTag = (typeof AVAILABLE_AMBIENTS)[number];

const LANGUAGE_TO_AMBIENT_SUFFIX: Record<string, string> = {
  spanish: "es",
  german: "de",
  english: "en",
  french: "fr",
  italian: "it",
  portuguese: "pt",
};

const LANGUAGE_TO_PYTHON_LANG: Record<string, string> = {
  english: "en",
  spanish: "es",
  french: "fr",
  italian: "it",
  portuguese: "pt",
  german: "de",
  japanese: "ja",
  chinese: "zh",
  hindi: "hi",
};

function resolveAmbientPath(tag: string | null | undefined, language: string | null | undefined): string | null {
  if (!tag) return null;
  if (!(AVAILABLE_AMBIENTS as readonly string[]).includes(tag)) return null;
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

function runPythonTts(args: {
  text: string;
  voiceId: string;
  lang: string;
  ambientPath: string | null;
  outputPath: string;
}): Promise<void> {
  const projectRoot = process.cwd();
  const pythonBin = join(projectRoot, "scripts", "tts", ".venv", "bin", "python");
  const ttsScript = join(projectRoot, "scripts", "tts", "generate_audio.py");
  if (!existsSync(pythonBin)) {
    return Promise.reject(
      new Error(
        `Local TTS .venv not found at ${pythonBin}. Set LOCAL_TTS_ENABLED=1 and install the venv.`,
      ),
    );
  }
  if (!existsSync(ttsScript)) {
    return Promise.reject(new Error(`TTS script not found at ${ttsScript}`));
  }

  return new Promise((resolve, reject) => {
    const argv = [
      ttsScript,
      "--lang",
      args.lang,
      "--voice-id",
      args.voiceId,
      "--text",
      args.text,
      "--postprocess",
      "-o",
      args.outputPath,
    ];
    if (args.ambientPath) {
      argv.push("--ambient", args.ambientPath);
    }
    const child = spawn(pythonBin, argv, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: projectRoot,
    });
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => console.log(`[tts:py] ${chunk.toString().trimEnd()}`));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
    child.on("error", (err) => reject(new Error(`Failed to spawn Python: ${err.message}`)));
    child.on("close", (code) => {
      if (code === 0) return resolve();
      const stderr = Buffer.concat(stderrChunks).toString();
      reject(new Error(`Python TTS exited ${code}. stderr: ${stderr.slice(-600)}`));
    });
  });
}

// Crossfade durations differ by path:
//   - LEGACY path: 200ms because the ambient is locally re-mixed in the
//     new tramo, and the longer fade masks the ambient phase shift at
//     the seam (the ambient loop in the new tramo starts from sample 0
//     instead of continuing the master's phase).
//   - DRY-STEM path: 80ms because we splice voice-only against voice-
//     only, then re-render ambient continuously over the result. The
//     ambient never has a discontinuity, so we only need to mask the
//     voice-on-voice transition (a much smaller artifact, especially
//     when both sides are the same speaker).
const CROSSFADE_SEC = 0.2;
const VOICE_CROSSFADE_SEC = 0.08;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    storyId?: string;
    startSec?: number;
    endSec?: number;
    charStart?: number;
    charEnd?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { storyId, startSec, endSec, charStart, charEnd } = body;
  if (
    !storyId ||
    typeof startSec !== "number" ||
    typeof endSec !== "number" ||
    typeof charStart !== "number" ||
    typeof charEnd !== "number"
  ) {
    return NextResponse.json({ error: "Missing storyId/startSec/endSec/charStart/charEnd" }, { status: 400 });
  }
  if (endSec <= startSec) {
    return NextResponse.json({ error: "endSec must be > startSec" }, { status: 400 });
  }
  if (endSec - startSec < CROSSFADE_SEC * 2 + 0.05) {
    return NextResponse.json(
      { error: `Selección demasiado corta (mínimo ${(CROSSFADE_SEC * 2 + 0.05).toFixed(2)}s)` },
      { status: 400 },
    );
  }
  // The acrossfade filter needs at least `d` seconds on each side of the
  // splice. Cut-too-early or cut-too-late will fail with an opaque
  // ffmpeg error — surface a clear message instead AND avoid spending
  // an ElevenLabs credit on a selection we know we can't splice.
  if (startSec < CROSSFADE_SEC) {
    return NextResponse.json(
      {
        error: `La selección empieza demasiado cerca del inicio (${startSec.toFixed(2)}s < ${CROSSFADE_SEC}s). Elige una palabra después de los primeros ${(CROSSFADE_SEC * 1000).toFixed(0)}ms.`,
      },
      { status: 400 },
    );
  }

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: { select: { language: true } } },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (!story.audioUrl) return NextResponse.json({ error: "Story has no audio" }, { status: 400 });
  if (!story.text) return NextResponse.json({ error: "Story has no text" }, { status: 400 });

  // Re-derive the plain text the same way alignment did, so charStart/charEnd
  // are valid offsets.
  const { extractStoryPlainText } = await import("@/lib/storyPlainText");
  const storyPlainText = extractStoryPlainText(story.text);
  const segmentText = storyPlainText.slice(charStart, charEnd).trim();
  if (!segmentText) {
    return NextResponse.json({ error: "Selección vacía tras strip" }, { status: 400 });
  }

  // Resolve the right voice for the selection. For multi-voice stories
  // (Café in Kreuzberg etc.) the voice depends on which speaker is talking
  // at this point in the body. For single-voice stories the block voice is
  // the same as story.voiceId.
  const blocks = deriveAudioEditorBlocks({
    storyText: story.text,
    storyPlainText,
    storyVoiceId: story.voiceId,
    dialogueSpec: story.dialogueSpec,
  });
  const blockIdx = findBlockForChar(blocks, charStart, charEnd);
  if (blockIdx < 0) {
    return NextResponse.json(
      {
        error:
          "La selección cruza un cambio de voz/personaje. Selecciona dentro de un mismo bloque (narrador o un solo personaje).",
      },
      { status: 400 },
    );
  }
  const voiceId = blocks[blockIdx].voiceId;
  if (!voiceId) {
    return NextResponse.json(
      {
        error: `No hay voiceId para el bloque "${blocks[blockIdx].speakerLabel}".`,
      },
      { status: 400 },
    );
  }
  const isElevenLabs = voiceId.startsWith("elevenlabs/");
  const elVoiceId = isElevenLabs ? voiceId.slice("elevenlabs/".length).trim() : null;
  if (isElevenLabs && !elVoiceId) {
    return NextResponse.json(
      { error: `voiceId is malformed (empty after "elevenlabs/" prefix): "${voiceId}"` },
      { status: 400 },
    );
  }
  const language = story.journey.language;
  const ambientTag = story.ambientTag as AmbientTag | null;
  const ambientFile = resolveAmbientPath(ambientTag, language);

  // Determine the splice path:
  //   - DRY-STEM path (preferred): the story was generated with a dry
  //     stem saved separately in voiceProvenance.dryUrl. We splice
  //     voice-on-voice into the dry track and re-render ambient
  //     continuously over the result → no ambient phase shift at the
  //     seam, only a tiny voice crossfade.
  //   - LEGACY path: older stories without a dry stem. We splice into
  //     the mixed master and re-mix ambient locally in the new tramo
  //     → audible ambient shimmer at the seam, masked by 200ms fade.
  const provenance = readVoiceProvenance(story.voiceProvenance);
  const dryUrl = provenance.dryUrl ?? null;
  const useDryStemPath = !!dryUrl && !!ambientFile;
  const spliceXfade = useDryStemPath ? VOICE_CROSSFADE_SEC : CROSSFADE_SEC;

  // Set up workdir.
  const workDir = mkdtempSync(join(tmpdir(), `audio-edit-${storyId}-`));
  const newSegProcessed = join(workDir, "new_processed.mp3");
  const masterPath = join(workDir, "master.mp3");
  const outPath = join(workDir, "out.mp3");
  // Dry-stem-only workfiles.
  const dryMasterPath = join(workDir, "dry_master.mp3");
  const splicedDryPath = join(workDir, "spliced_dry.mp3");

  try {
    // ── Step 1: download the appropriate source + boundary validate ──
    // (downloading first so we burn zero TTS credits if the selection
    // is out of bounds.)
    const sourceUrl = useDryStemPath ? (dryUrl as string) : story.audioUrl;
    const sourceBuf = await downloadToBuffer(sourceUrl);
    const sourceLocalPath = useDryStemPath ? dryMasterPath : masterPath;
    writeFileSync(sourceLocalPath, sourceBuf);
    const sourceDuration = await ffprobeDuration(sourceLocalPath);
    if (endSec >= sourceDuration) {
      return NextResponse.json(
        {
          error: `endSec (${endSec.toFixed(2)}s) excede ${useDryStemPath ? "dry stem" : "master"} (${sourceDuration.toFixed(2)}s)`,
        },
        { status: 400 },
      );
    }
    if (endSec > sourceDuration - spliceXfade) {
      return NextResponse.json(
        {
          error: `La selección termina demasiado cerca del final del audio (${endSec.toFixed(2)}s, duración ${sourceDuration.toFixed(2)}s). Necesitamos al menos ${spliceXfade}s de margen para el crossfade.`,
        },
        { status: 400 },
      );
    }

    // ── Step 2: synthesize the new segment ──
    // In DRY-STEM path: voice only, no ambient, no tempo (so it matches
    // the dry stem's flat profile). In LEGACY path: full post-process
    // including ambient mix + tempo (so the new tramo matches the
    // master's mixed profile).
    if (isElevenLabs) {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "ELEVENLABS_API_KEY missing" }, { status: 500 });
      }
      const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: softenPunctuationForTts(segmentText),
          model_id: "eleven_multilingual_v2",
          voice_settings: DEFAULT_VOICE_SETTINGS,
          // Paridad con el pipeline (disableStitching): NO previous_text
          // (evita la inhalación de costura) + next_text=" " como boundary,
          // que suprime el respiro/exhalación de cola (la "cola tipo va-a-haber"
          // que peleamos el 2026-06-11). Sin esto, una regeneración del editor
          // puede reintroducir ese aire de cola.
          next_text: " ",
        }),
      });
      if (!ttsRes.ok) {
        const detail = await ttsRes.text().catch(() => "");
        return NextResponse.json(
          { error: `ElevenLabs ${ttsRes.status}: ${detail.slice(0, 300)}` },
          { status: 502 },
        );
      }
      const rawSegPath = join(workDir, "raw.mp3");
      writeFileSync(rawSegPath, Buffer.from(await ttsRes.arrayBuffer()));

      const ffArgs = ["-y", "-loglevel", "error", "-i", rawSegPath];
      if (useDryStemPath) {
        // Match the dry stem's profile: dynaudnorm + loudnorm only
        // (same chain as normalizeLoudness in elevenlabs.ts). No tempo,
        // no ambient — those happen later in the pipeline.
        ffArgs.push(
          "-af",
          `dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5`,
        );
      } else {
        // Legacy: match the mixed master profile (tempo + ambient + loudnorm).
        // Ambient never plays under the narrator (out-of-scene VO), so a
        // narrator block previews dry (memory: feedback_ambient_not_under_narrator).
        const tempo = DEFAULT_NARRATION_TEMPO;
        const isNarratorBlock = blocks[blockIdx].speakerLabel === "narrator";
        if (ambientFile && !isNarratorBlock) {
          ffArgs.push("-stream_loop", "-1", "-i", ambientFile);
          const filter =
            `[0:a]atempo=${tempo}[s];` +
            `[1:a]volume=${DEFAULT_AMBIENT_VOLUME}[a1];` +
            `[s][a1]amix=inputs=2:duration=first:dropout_transition=0[mix];` +
            `[mix]dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5`;
          ffArgs.push("-filter_complex", filter);
        } else {
          ffArgs.push(
            "-af",
            `atempo=${tempo},dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5`,
          );
        }
      }
      ffArgs.push("-codec:a", "libmp3lame", "-b:a", "128k", newSegProcessed);
      await runFfmpeg(ffArgs);
    } else {
      // Local Python TTS path (qwen, qwen17, piper, kokoro, f5, chatterbox).
      if (process.env.LOCAL_TTS_ENABLED !== "1") {
        return NextResponse.json(
          {
            error: `Voice "${voiceId}" requires the local Python TTS pipeline. Set LOCAL_TTS_ENABLED=1 in your .env.local.`,
          },
          { status: 501 },
        );
      }
      const pyLang = LANGUAGE_TO_PYTHON_LANG[language.toLowerCase()] ?? "es";
      await runPythonTts({
        text: segmentText,
        voiceId,
        lang: pyLang,
        // In dry-stem mode the ambient is rendered later over the
        // entire spliced dry; we don't want Python to mix it locally.
        ambientPath: useDryStemPath ? null : ambientFile,
        outputPath: newSegProcessed,
      });
    }

    const newDuration = await ffprobeDuration(newSegProcessed);
    const minNewDuration = spliceXfade * 2 + 0.02;
    if (newDuration < minNewDuration) {
      return NextResponse.json(
        {
          error: `Segmento regenerado muy corto (${newDuration.toFixed(2)}s, mínimo ${minNewDuration.toFixed(2)}s para crossfade x2)`,
        },
        { status: 500 },
      );
    }

    // ── Step 3: splice ──
    // `aformat` normalizes channels + sample rate + sample format on
    // every branch so acrossfade can combine them (acrossfade is strict
    // about layout matching and would otherwise fail with an opaque
    // "incompatible streams" error).
    const NORM = "aformat=channel_layouts=stereo:sample_rates=44100:sample_fmts=fltp";
    const spliceTargetPath = useDryStemPath ? splicedDryPath : outPath;
    const splArgs = [
      "-y",
      "-loglevel",
      "error",
      "-i",
      sourceLocalPath,
      "-i",
      newSegProcessed,
      "-filter_complex",
      [
        `[0:a]atrim=0:${startSec.toFixed(3)},asetpts=PTS-STARTPTS,${NORM}[before]`,
        `[0:a]atrim=${endSec.toFixed(3)},asetpts=PTS-STARTPTS,${NORM}[after]`,
        `[1:a]${NORM}[seg]`,
        `[before][seg]acrossfade=d=${spliceXfade}:c1=tri:c2=tri[mid]`,
        `[mid][after]acrossfade=d=${spliceXfade}:c1=tri:c2=tri[out]`,
      ].join(";"),
      "-map",
      "[out]",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "128k",
      spliceTargetPath,
    ];
    await runFfmpeg(splArgs);

    // ── Step 4 (DRY-STEM path only): re-render ambient continuously
    // over the spliced dry. The ambient pass is identical to what
    // `mixAmbient` does at master-generation time, so the resulting
    // mixed master is bit-equivalent in ambient profile to a fresh
    // generation — no seams, no shimmer.
    let newDryUrl: string | null = null;
    let newDryFilename: string | null = null;
    if (useDryStemPath && ambientFile) {
      // Silence the bed during narrator (VO) ranges, scaled to the spliced
      // master's real duration (memory: feedback_ambient_not_under_narrator).
      const { intervals, span } = computeNarratorOffIntervals(story.text ?? "", story.audioSegments);
      const mixedDuration = await ffprobeDuration(splicedDryPath);
      const ambientStage = buildAmbientStage({
        inLabel: "1:a",
        outLabel: "a1",
        volume: DEFAULT_AMBIENT_VOLUME,
        offIntervals: intervals,
        scale: span > 0 ? mixedDuration / span : 0,
      });
      const ambientMixArgs = [
        "-y",
        "-loglevel",
        "error",
        "-i",
        splicedDryPath,
        "-stream_loop",
        "-1",
        "-i",
        ambientFile,
        "-filter_complex",
        `${ambientStage};` +
          `[0:a][a1]amix=inputs=2:duration=first:dropout_transition=2[mix];` +
          `[mix]loudnorm=I=-16:LRA=11:TP=-1.5`,
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "128k",
        outPath,
      ];
      await runFfmpeg(ambientMixArgs);

      // Upload the spliced DRY stem so future edits keep the clean
      // splice path. Without this, the second edit would lose the dry
      // stem and fall back to legacy splicing.
      const baseDryName = (provenance.dryFilename ?? `${story.slug}_dry.mp3`)
        .replace(/\.mp3$/, "")
        .replace(/_edit\d+$/, "");
      newDryFilename = `${baseDryName}_edit${Date.now()}.mp3`;
      const dryBuf = readFileSync(splicedDryPath);
      const dryUpload = await uploadPublicObject({
        key: `media/generated/audio/${newDryFilename}`,
        body: dryBuf,
        contentType: "audio/mpeg",
      });
      if (!dryUpload?.url) {
        return NextResponse.json({ error: "Upload R2 falló (dry stem)" }, { status: 500 });
      }
      newDryUrl = dryUpload.url;
    }

    const processed = readFileSync(outPath);
    const baseName = (story.audioFilename ?? `${story.slug}.mp3`)
      .replace(/\.mp3$/, "")
      .replace(/_edit\d+$/, "");
    const newFilename = `${baseName}_edit${Date.now()}.mp3`;
    const uploaded = await uploadPublicObject({
      key: `media/generated/audio/${newFilename}`,
      body: processed,
      contentType: "audio/mpeg",
    });
    if (!uploaded?.url) {
      return NextResponse.json({ error: "Upload R2 falló" }, { status: 500 });
    }

    // Persist the preview master + (in dry-stem mode) the new preview
    // dry stem. On promote, both move from preview slots to canonical
    // (audioUrl + voiceProvenance.dryUrl).
    const updatedProvenance = useDryStemPath
      ? mergeVoiceProvenance(story.voiceProvenance, {
          previewDryUrl: newDryUrl,
          previewDryFilename: newDryFilename,
        })
      : null;

    await prisma.journeyStory.update({
      where: { id: storyId },
      data: {
        audioUrlPreview: uploaded.url,
        audioFilenamePreview: newFilename,
        ...(updatedProvenance
          ? { voiceProvenance: updatedProvenance as unknown as object }
          : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      audioUrlPreview: uploaded.url,
      audioFilenamePreview: newFilename,
      engine: isElevenLabs ? "elevenlabs" : "python-local",
      path: useDryStemPath ? "dry-stem" : "legacy",
      regeneratedSegment: {
        startSec,
        endSec,
        textLength: segmentText.length,
        newSegmentDurationSec: newDuration,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pipeline failed" },
      { status: 500 },
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
