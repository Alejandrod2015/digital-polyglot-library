import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { uploadPublicObject } from "@/lib/objectStorage";
import { buildAudioNarrationText } from "@/lib/elevenlabs";
import { findVoice, DEFAULT_VOICE_BY_LANGUAGE } from "@/lib/voiceCatalog";

export const maxDuration = 300;

const LANGUAGE_TO_KOKORO: Record<string, string> = {
  english: "en",
  spanish: "es",
  french: "fr",
  italian: "it",
  portuguese: "pt",
  japanese: "ja",
  chinese: "zh",
  hindi: "hi",
};

function projectRoot(): string {
  return process.cwd();
}

function pythonBinary(): string {
  return join(projectRoot(), "scripts", "tts", ".venv", "bin", "python");
}

function ttsScript(): string {
  return join(projectRoot(), "scripts", "tts", "generate_audio.py");
}

const AVAILABLE_AMBIENTS = ["mercado", "metro", "restaurante", "bar", "cafeteria"] as const;
type AmbientTag = (typeof AVAILABLE_AMBIENTS)[number];

const LANGUAGE_TO_AMBIENT_SUFFIX: Record<string, string> = {
  spanish: "es",
  german: "de",
  english: "en",
  french: "fr",
  italian: "it",
  portuguese: "pt",
};

function ambientPath(tag: string | null | undefined, language: string | null | undefined): string | null {
  if (!tag) return null;
  if (!AVAILABLE_AMBIENTS.includes(tag as AmbientTag)) return null;
  const dir = join(projectRoot(), "scripts", "tts", "ambience");
  // Prefer language-matched ambient (e.g. cafeteria_de.mp3) so background voices
  // match the target language. Fall back to the generic file if no localized one exists.
  const langKey = language?.toLowerCase();
  const suffix = langKey ? LANGUAGE_TO_AMBIENT_SUFFIX[langKey] : null;
  if (suffix) {
    const localized = join(dir, `${tag}_${suffix}.mp3`);
    if (existsSync(localized)) return localized;
  }
  const generic = join(dir, `${tag}.mp3`);
  return existsSync(generic) ? generic : null;
}

function filenameFromTitle(title: string): string {
  return title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
}

const MODAL_PIPER_VOICES = new Set([
  "piper/es_ES-sharvard-medium",
  "piper/pt_BR-cadu-medium",
  "piper/it_IT-paola-medium",
]);

async function synthesizeViaModal(args: {
  text: string;
  voiceId: string;
  filename: string;
}): Promise<{ url: string; filename: string; bytes: number }> {
  const url = process.env.STUDIO_AUDIO_URL;
  const token = process.env.STUDIO_AUDIO_TOKEN;
  if (!url || !token) throw new Error("STUDIO_AUDIO_URL/TOKEN not configured");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      _token: token,
      text: args.text,
      voiceId: args.voiceId,
      filename: args.filename.replace(/\.mp3$/, ""),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Modal TTS ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json();
}

async function runPythonTTS(args: {
  text?: string;
  specPath?: string;
  lang: string;
  outputPath: string;
  voiceId?: string | null;
  ambientPath?: string | null;
  refAudioPath?: string | null;
  refText?: string | null;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const argv = [ttsScript(), "--lang", args.lang, "--postprocess", "-o", args.outputPath];
    if (args.specPath) {
      argv.push("--spec", args.specPath);
    } else if (args.text) {
      argv.push("--text", args.text);
    }
    if (args.voiceId && !args.specPath) argv.push("--voice-id", args.voiceId);
    if (args.ambientPath) argv.push("--ambient", args.ambientPath);
    if (args.refAudioPath) argv.push("--ref-audio", args.refAudioPath);
    if (args.refText) argv.push("--ref-text", args.refText);
    const child = spawn(
      pythonBinary(),
      argv,
      { stdio: ["ignore", "pipe", "pipe"], cwd: projectRoot() }
    );

    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => console.log(`[tts:py] ${chunk.toString().trimEnd()}`));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

    child.on("error", (err) => reject(new Error(`Failed to spawn Python: ${err.message}`)));
    child.on("close", (code) => {
      if (code === 0) return resolve();
      const stderr = Buffer.concat(stderrChunks).toString();
      reject(new Error(`Python exited with code ${code}. stderr: ${stderr.slice(-800)}`));
    });
  });
}

export async function POST(request: Request) {
  const modalEnabled = !!(process.env.STUDIO_AUDIO_URL && process.env.STUDIO_AUDIO_TOKEN);
  const localEnabled = process.env.LOCAL_TTS_ENABLED === "1";
  if (!modalEnabled && !localEnabled) {
    return NextResponse.json(
      {
        error: "Audio propio is not enabled in this environment.",
        hint: "Set STUDIO_AUDIO_URL + STUDIO_AUDIO_TOKEN (Modal) or LOCAL_TTS_ENABLED=1 (local .venv).",
      },
      { status: 503 }
    );
  }

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { storyId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const story = await prisma.journeyStory.findUnique({ where: { id: storyId }, include: { journey: true } });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (!story.text || !story.title) {
    return NextResponse.json({ error: "Story needs text and title before generating audio" }, { status: 400 });
  }

  const langKey = story.journey.language.toLowerCase();
  // Resolve the chosen voice. If voiceId starts with "f5/", look it up in ClonedVoice;
  // otherwise look it up in the static catalog. Default by language if unset.
  const chosenVoiceId = story.voiceId || DEFAULT_VOICE_BY_LANGUAGE[langKey] || null;
  let resolvedVoiceId = chosenVoiceId;
  let refAudioPath: string | null = null;
  let refText: string | null = null;

  // Skip single-voice validation when story has a multi-voice spec (each segment
  // brings its own voice, validated by /api/studio/audio/dialogue on save).
  const hasDialogueSpec = Array.isArray(story.dialogueSpec) && (story.dialogueSpec as unknown[]).length > 0;
  if (!hasDialogueSpec) {
    if (chosenVoiceId?.startsWith("f5/")) {
      const cloned = await prisma.clonedVoice.findUnique({ where: { id: chosenVoiceId.slice(3) } });
      if (!cloned) {
        return NextResponse.json({ error: `Cloned voice not found: ${chosenVoiceId}` }, { status: 400 });
      }
      refAudioPath = cloned.refAudioPath;
      refText = cloned.refText;
    } else if (!findVoice(chosenVoiceId)) {
      return NextResponse.json(
        { error: `No voice configured for language "${story.journey.language}". Pick one in the Studio dropdown.` },
        { status: 400 }
      );
    }
  }

  // Kokoro needs a 2-letter --lang for its language code map. Piper/F5 infer from model/voice.
  const kokoroLang = LANGUAGE_TO_KOKORO[langKey] ?? "es";

  const tempDir = await mkdtemp(join(tmpdir(), "tts-"));
  const filename = `${filenameFromTitle(story.title)}_${Date.now()}.mp3`;
  const tempFile = join(tempDir, filename);
  const isPreview = !!story.audioUrl;

  try {
    if (!isPreview) {
      await prisma.journeyStory.update({ where: { id: storyId }, data: { audioStatus: "generating" } });
    }

    const narration = buildAudioNarrationText(story.title, story.text);
    const ambient = ambientPath(story.ambientTag, story.journey.language);

    // Modal fast path: single-voice Piper, no ambient, no F5. Anything more
    // exotic falls through to the legacy local-Python path below (which needs
    // LOCAL_TTS_ENABLED=1 + a working .venv).
    const canUseModal =
      modalEnabled &&
      !hasDialogueSpec &&
      !ambient &&
      !refAudioPath &&
      typeof resolvedVoiceId === "string" &&
      MODAL_PIPER_VOICES.has(resolvedVoiceId);

    if (canUseModal) {
      const result = await synthesizeViaModal({
        text: narration,
        voiceId: resolvedVoiceId!,
        filename,
      });

      if (isPreview) {
        await prisma.journeyStory.update({
          where: { id: storyId },
          data: { audioUrlPreview: result.url, audioFilenamePreview: result.filename },
        });
      } else {
        await prisma.journeyStory.update({
          where: { id: storyId },
          data: {
            audioUrl: result.url,
            audioFilename: result.filename,
            audioSegments: [],
            audioStatus: "ready",
            voiceId: resolvedVoiceId,
            audioQaStatus: null,
            audioQaScore: null,
            audioQaNotes: null,
          },
        });
      }
      return NextResponse.json({ ok: true, audioUrl: result.url, filename: result.filename, isPreview, via: "modal" });
    }

    if (!localEnabled) {
      return NextResponse.json(
        { error: `Voice "${resolvedVoiceId ?? "default"}" not yet supported in cloud (Modal). Only the 3 approved Piper voices (es/pt/it) run in cloud today.` },
        { status: 501 }
      );
    }

    // If the story has a multi-voice dialogueSpec, resolve any f5/* refs and
    // emit it as a temp JSON file. Otherwise fall back to single-voice flow.
    let specPath: string | null = null;
    const rawSpec = story.dialogueSpec as unknown;
    if (Array.isArray(rawSpec) && rawSpec.length > 0) {
      const resolvedSpec = [];
      for (const seg of rawSpec as Array<{ voice: string; text: string }>) {
        if (seg.voice?.startsWith("f5/")) {
          const cv = await prisma.clonedVoice.findUnique({ where: { id: seg.voice.slice(3) } });
          if (!cv) throw new Error(`Cloned voice not found in spec: ${seg.voice}`);
          resolvedSpec.push({ voice: seg.voice, text: seg.text, ref_audio: cv.refAudioPath, ref_text: cv.refText });
        } else {
          resolvedSpec.push({ voice: seg.voice, text: seg.text });
        }
      }
      specPath = join(tempDir, "spec.json");
      await writeFile(specPath, JSON.stringify(resolvedSpec));
    }

    await runPythonTTS({
      text: specPath ? undefined : narration,
      specPath: specPath ?? undefined,
      lang: kokoroLang,
      outputPath: tempFile,
      voiceId: specPath ? undefined : (resolvedVoiceId ?? undefined),
      ambientPath: ambient,
      refAudioPath: specPath ? null : refAudioPath,
      refText: specPath ? null : refText,
    });

    const buffer = await readFile(tempFile);
    const uploaded = await uploadPublicObject({
      key: `media/generated/audio/${filename}`,
      body: buffer,
      contentType: "audio/mpeg",
    });
    if (!uploaded?.url) {
      throw new Error("MEDIA_STORAGE upload failed (uploadPublicObject returned null). Check MEDIA_STORAGE_* env vars.");
    }

    if (isPreview) {
      await prisma.journeyStory.update({
        where: { id: storyId },
        data: {
          audioUrlPreview: uploaded.url,
          audioFilenamePreview: filename,
        },
      });
    } else {
      await prisma.journeyStory.update({
        where: { id: storyId },
        data: {
          audioUrl: uploaded.url,
          audioFilename: filename,
          audioSegments: [],
          audioStatus: "ready",
          voiceId: resolvedVoiceId,
          audioQaStatus: null,
          audioQaScore: null,
          audioQaNotes: null,
        },
      });
    }

    return NextResponse.json({ ok: true, audioUrl: uploaded.url, filename, isPreview });
  } catch (error) {
    console.error("[studio/audio/generate-local] failed:", error);
    if (!isPreview) {
      await prisma.journeyStory
        .update({ where: { id: storyId }, data: { audioStatus: "failed" } })
        .catch(() => {});
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to generate audio", details: message }, { status: 500 });
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
