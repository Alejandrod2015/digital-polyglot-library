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
import { coerceAudioWordTimings } from "@/lib/audioWordTimings";
import { deriveAudioEditorBlocks } from "@/lib/audioEditorBlocks";
import { computeNarratorOffIntervals, buildAmbientStage } from "@/lib/narrationPostProcess";
import { mergeVoiceProvenance, readVoiceProvenance } from "@/lib/voiceProvenance";

export const maxDuration = 300;

/**
 * POST /api/studio/audio-editor/preview-title
 *
 * Body: { storyId, newTitle }
 *
 * Regenerate ONLY the title narration ([0s → titleEndSec] of the master)
 * with the new title text. Uses the narrator's voice (i.e. the voice
 * covering char 0 in the story — for multi-voice stories that's the
 * first dialogueSpec entry). Splice with an 80ms crossfade at the right
 * boundary; left boundary is just the new clip's start.
 *
 * The new title text is NOT persisted to `story.title` until /promote
 * is called with the same newTitle in its body.
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
    proc.stderr.on("data", (c) => (stderr += c.toString()));
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
    if (args.ambientPath) argv.push("--ambient", args.ambientPath);
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

function endTitleWithPeriod(title: string): string {
  const trimmed = title.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return /[.!?…:]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

// See preview-segment for the rationale on these two crossfade durations.
// Dry-stem path uses a small voice crossfade because ambient is rendered
// continuously over the result; legacy path uses a longer crossfade to
// mask the ambient phase shift at the seam.
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

  let body: { storyId?: string; newTitle?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { storyId, newTitle } = body;
  if (!storyId || typeof newTitle !== "string") {
    return NextResponse.json({ error: "storyId + newTitle required" }, { status: 400 });
  }
  const cleanedTitle = endTitleWithPeriod(newTitle);
  if (!cleanedTitle) {
    return NextResponse.json({ error: "newTitle vacío" }, { status: 400 });
  }

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: { select: { language: true } } },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (!story.audioUrl) return NextResponse.json({ error: "Story has no audio" }, { status: 400 });
  if (!story.text) return NextResponse.json({ error: "Story has no text" }, { status: 400 });

  const timings = coerceAudioWordTimings(story.audioWordTimings);
  if (!timings) {
    return NextResponse.json(
      { error: "Story has no word timings — run alignment first" },
      { status: 400 },
    );
  }
  const firstWord = timings.words.find(
    (w) => typeof w.startSec === "number" && Number.isFinite(w.startSec),
  );
  const titleEndSec = firstWord && typeof firstWord.startSec === "number" ? firstWord.startSec : null;
  if (titleEndSec === null || titleEndSec <= 0) {
    return NextResponse.json(
      { error: "No se puede inferir la duración del título desde word timings" },
      { status: 400 },
    );
  }

  const { extractStoryPlainText } = await import("@/lib/storyPlainText");
  const storyPlainText = extractStoryPlainText(story.text);
  const blocks = deriveAudioEditorBlocks({
    storyText: story.text,
    storyPlainText,
    storyVoiceId: story.voiceId,
    dialogueSpec: story.dialogueSpec,
  });
  const narratorVoiceId = blocks.length > 0 ? blocks[0].voiceId : story.voiceId;
  if (!narratorVoiceId) {
    return NextResponse.json(
      { error: "No hay voz de narrador configurada para regenerar el título" },
      { status: 400 },
    );
  }

  const isElevenLabs = narratorVoiceId.startsWith("elevenlabs/");
  const elVoiceId = isElevenLabs ? narratorVoiceId.slice("elevenlabs/".length).trim() : null;
  if (isElevenLabs && !elVoiceId) {
    return NextResponse.json(
      { error: `Narrator voiceId is malformed (empty after "elevenlabs/" prefix): "${narratorVoiceId}"` },
      { status: 400 },
    );
  }
  const language = story.journey.language;
  const ambientTag = story.ambientTag as AmbientTag | null;
  const ambientFile = resolveAmbientPath(ambientTag, language);

  // Same dry-stem branching as /preview-segment. When the story has
  // voiceProvenance.dryUrl set, we splice voice-on-voice into the dry
  // stem and re-render ambient continuously — bit-perfect ambient.
  const provenance = readVoiceProvenance(story.voiceProvenance);
  const dryUrl = provenance.dryUrl ?? null;
  const useDryStemPath = !!dryUrl && !!ambientFile;
  const spliceXfade = useDryStemPath ? VOICE_CROSSFADE_SEC : CROSSFADE_SEC;

  const workDir = mkdtempSync(join(tmpdir(), `audio-edit-title-${storyId}-`));
  const newSegProcessed = join(workDir, "new_title.mp3");
  const masterPath = join(workDir, "master.mp3");
  const dryMasterPath = join(workDir, "dry_master.mp3");
  const splicedDryPath = join(workDir, "spliced_dry.mp3");
  const outPath = join(workDir, "out.mp3");

  try {
    // ── Step 1: download appropriate source + boundary validate ──
    const sourceUrl = useDryStemPath ? (dryUrl as string) : story.audioUrl;
    const sourceLocalPath = useDryStemPath ? dryMasterPath : masterPath;
    const sourceBuf = await downloadToBuffer(sourceUrl);
    writeFileSync(sourceLocalPath, sourceBuf);
    const sourceDuration = await ffprobeDuration(sourceLocalPath);
    if (titleEndSec >= sourceDuration) {
      return NextResponse.json(
        {
          error: `titleEndSec (${titleEndSec.toFixed(2)}s) excede ${useDryStemPath ? "dry stem" : "master"} (${sourceDuration.toFixed(2)}s)`,
        },
        { status: 400 },
      );
    }
    if (titleEndSec > sourceDuration - spliceXfade) {
      return NextResponse.json(
        {
          error: `El título termina demasiado cerca del final del audio (${titleEndSec.toFixed(2)}s, duración ${sourceDuration.toFixed(2)}s). Necesitamos al menos ${spliceXfade}s de margen.`,
        },
        { status: 400 },
      );
    }

    // ── Step 2: synthesize new title ──
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
          text: softenPunctuationForTts(cleanedTitle),
          model_id: "eleven_multilingual_v2",
          voice_settings: DEFAULT_VOICE_SETTINGS,
          // Paridad con el pipeline (disableStitching): next_text=" " boundary
          // que suprime el respiro de cola; sin previous_text para no meter
          // inhalación de costura. Ver preview-segment.
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
        // Match the dry stem profile (loudnorm only, no tempo, no ambient).
        ffArgs.push(
          "-af",
          `dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5`,
        );
      } else {
        // Legacy: match mixed master profile. The title is narrated by the
        // narrator (out-of-scene VO), so the ambient bed never plays under it
        // (memory: feedback_ambient_not_under_narrator) — always render dry.
        const tempo = DEFAULT_NARRATION_TEMPO;
        ffArgs.push(
          "-af",
          `atempo=${tempo},dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5`,
        );
      }
      ffArgs.push("-codec:a", "libmp3lame", "-b:a", "128k", newSegProcessed);
      await runFfmpeg(ffArgs);
    } else {
      if (process.env.LOCAL_TTS_ENABLED !== "1") {
        return NextResponse.json(
          {
            error: `Narrator voice "${narratorVoiceId}" requires the local Python TTS pipeline. Set LOCAL_TTS_ENABLED=1.`,
          },
          { status: 501 },
        );
      }
      const pyLang = LANGUAGE_TO_PYTHON_LANG[language.toLowerCase()] ?? "es";
      await runPythonTts({
        text: cleanedTitle,
        voiceId: narratorVoiceId,
        lang: pyLang,
        ambientPath: useDryStemPath ? null : ambientFile,
        outputPath: newSegProcessed,
      });
    }

    // ── Step 3: validate new title duration ──
    const newDuration = await ffprobeDuration(newSegProcessed);
    if (newDuration < spliceXfade + 0.05) {
      return NextResponse.json(
        {
          error: `Título regenerado muy corto (${newDuration.toFixed(2)}s, mínimo ${(spliceXfade + 0.05).toFixed(2)}s para crossfade)`,
        },
        { status: 500 },
      );
    }

    // ── Step 4: single splice [new_title] x-fade [source from titleEndSec] ──
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
        `[0:a]atrim=${titleEndSec.toFixed(3)},asetpts=PTS-STARTPTS,${NORM}[after]`,
        `[1:a]${NORM}[seg]`,
        `[seg][after]acrossfade=d=${spliceXfade}:c1=tri:c2=tri[out]`,
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

    // ── Step 5 (DRY-STEM only): re-render ambient over the spliced dry ──
    let newDryUrl: string | null = null;
    let newDryFilename: string | null = null;
    if (useDryStemPath && ambientFile) {
      // Silence the bed during narrator (VO) ranges. Segments are scaled to
      // the spliced master's actual duration so the gate lands correctly
      // regardless of tempo/splice drift (memory: feedback_ambient_not_under_narrator).
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

      // Upload the spliced DRY stem so future edits keep the clean path.
      const baseDryName = (provenance.dryFilename ?? `${story.slug}_dry.mp3`)
        .replace(/\.mp3$/, "")
        .replace(/_edit\d+$/, "")
        .replace(/_titleedit\d+$/, "");
      newDryFilename = `${baseDryName}_titleedit${Date.now()}.mp3`;
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
    const newFilename = `${baseName}_titleedit${Date.now()}.mp3`;
    const uploaded = await uploadPublicObject({
      key: `media/generated/audio/${newFilename}`,
      body: processed,
      contentType: "audio/mpeg",
    });
    if (!uploaded?.url) {
      return NextResponse.json({ error: "Upload R2 falló" }, { status: 500 });
    }

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
      newTitleDurationSec: newDuration,
      replacedRangeSec: { startSec: 0, endSec: titleEndSec },
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
