/**
 * Generate single-voice narrator audio for any JourneyStory using a
 * Chatterbox cloned voice. Generalized from `regenerateTintoAudio.ts`
 * (which was hardcoded to slots 0 and 1 of one specific journey).
 *
 * Pipeline:
 *   1. Read story from DB, split text by <blockquote>.
 *   2. For each segment, spawn Python from .venv-chatterbox to synthesize
 *      a WAV using the reference clip at public/voice-samples/<voice-flat>.mp3.
 *   3. Whisper-trim each WAV at the true end of speech to drop the
 *      phantom-syllable tail Chatterbox sometimes emits.
 *   4. Concat trimmed WAVs with 350 ms silence between, harmonize sample
 *      rate, loudnorm, encode MP3.
 *   5. Upload to R2, update DB (audioUrl/audioFilename/audioStatus/voiceId).
 *   6. Run aeneas alignment via generateWordTimingsForStory so the
 *      karaoke reader has per-word timings.
 *
 * Usage: tsx scripts/generateNarratorAudio.ts <storyId>
 *
 * Requires `voiceId` to be set on the story (must be `chatterbox/<name>`)
 * and a matching reference clip at public/voice-samples/<voice-flat>.mp3.
 */
import { prisma } from "@/lib/prisma";
import { uploadPublicObject } from "@/lib/objectStorage";
import { generateWordTimingsForStory } from "@/lib/audioWordTimings";
import { spawn, spawnSync } from "child_process";
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

const REPO = "/Users/alejandrodelcarpio/digital-polyglot-library";
const VENV_PY = `${REPO}/scripts/tts/.venv-chatterbox/bin/python`;
const GEN_SCRIPT = `${REPO}/scripts/tts/generate_chatterbox_segment.py`;
const WHISPER_BIN = "/opt/homebrew/bin/whisper-cli";
const WHISPER_MODEL = `${REPO}/scripts/tts/whisper-models/ggml-small.bin`;
const TRIM_MARGIN_SEC = 0.030;
const SILENCE_BETWEEN_SEC = 0.350;
const TARGET_SR = 24000;

function ffmpeg(args: string[]): Promise<void> {
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

function probeDuration(path: string): number {
  const r = spawnSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", path,
  ]);
  return parseFloat(r.stdout.toString().trim());
}

function whisperEndOfSpeech(wavPath: string, lang: string): number | null {
  if (!existsSync(WHISPER_BIN) || !existsSync(WHISPER_MODEL)) return null;
  const tmpPrefix = wavPath.replace(/\.wav$/, "_w");
  const r = spawnSync(WHISPER_BIN, [
    "-m", WHISPER_MODEL,
    "-f", wavPath,
    "-l", lang,
    "-ml", "1",
    "-oj",
    "-of", tmpPrefix,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const jsonPath = `${tmpPrefix}.json`;
  if (r.status !== 0 || !existsSync(jsonPath)) return null;
  try {
    const data = JSON.parse(readFileSync(jsonPath, "utf-8"));
    const items: Array<{ offsets?: { from?: number; to?: number }; text?: string }> =
      Array.isArray(data?.transcription) ? data.transcription : [];
    let lastWordEnd = -1;
    for (const it of items) {
      const txt = (it.text ?? "").trim();
      const hasLetter = /\p{L}/u.test(txt);
      const toMs = it.offsets?.to;
      if (hasLetter && typeof toMs === "number") {
        const sec = toMs / 1000;
        if (Number.isFinite(sec) && sec > lastWordEnd) lastWordEnd = sec;
      }
    }
    return lastWordEnd > 0 ? lastWordEnd : null;
  } catch {
    return null;
  } finally {
    try { rmSync(jsonPath); } catch { /* ignore */ }
  }
}

function splitBlockquotes(html: string): string[] {
  // Story bodies wrap each paragraph in <blockquote>...</blockquote>. We
  // synthesize one chunk per blockquote so Chatterbox isn't fed >30s of
  // text in a single shot. Decode common HTML entities, strip residual
  // tags, collapse whitespace.
  const re = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const inner = m[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    if (inner) out.push(inner);
  }
  // Fallback: if the body has no blockquote tags, split by blank lines.
  if (out.length === 0) {
    for (const para of html.split(/\n\s*\n+/)) {
      const p = para.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (p) out.push(p);
    }
  }
  return out;
}

function voiceIdToRefPath(voiceId: string): string {
  // Convention: `chatterbox/co_cof_07508` → public/voice-samples/chatterbox_co_cof_07508.mp3
  const flat = voiceId.replace(/\//g, "_");
  return `${REPO}/public/voice-samples/${flat}.mp3`;
}

function languageToWhisperCode(language: string): string {
  const map: Record<string, string> = {
    spanish: "es", italian: "it", portuguese: "pt",
    french: "fr", german: "de", english: "en",
  };
  return map[language.toLowerCase()] ?? "es";
}

async function main() {
  const storyId = process.argv[2];
  if (!storyId) {
    console.error("Usage: tsx scripts/generateNarratorAudio.ts <storyId>");
    process.exit(2);
  }

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story) throw new Error(`Story not found: ${storyId}`);
  if (!story.text || !story.title) throw new Error(`Story ${storyId} missing text or title`);
  if (!story.voiceId || !story.voiceId.startsWith("chatterbox/")) {
    throw new Error(`Story.voiceId must be chatterbox/* (got "${story.voiceId ?? "null"}"). Set it first.`);
  }

  const refAudio = voiceIdToRefPath(story.voiceId);
  if (!existsSync(refAudio)) throw new Error(`Reference audio missing: ${refAudio}`);

  const language = story.journey.language;
  const wLang = languageToWhisperCode(language);
  const segments = splitBlockquotes(story.text);
  // Prepend the title so the audio starts with the story title (matches
  // the convention used by the ElevenLabs route + buildAudioNarrationText).
  const allSegments = [story.title.trim(), ...segments];

  console.log(`Story: ${story.title} (${storyId})`);
  console.log(`Voice: ${story.voiceId}  ref=${refAudio.split("/").pop()}`);
  console.log(`Segments: ${allSegments.length}  language=${language}`);

  const workDir = `/tmp/narrator-${storyId}`;
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { audioStatus: "generating" },
  });

  // 1) Synthesize each segment.
  const rawWavs: string[] = [];
  for (let i = 0; i < allSegments.length; i++) {
    const wavPath = join(workDir, `seg_${String(i).padStart(3, "0")}.wav`);
    const text = allSegments[i];
    console.log(`  [${i.toString().padStart(3, "0")}] synth: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`);
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(VENV_PY, [
        GEN_SCRIPT,
        "--text", text,
        "--ref-audio", refAudio,
        "--output", wavPath,
      ], { stdio: ["ignore", "inherit", "inherit"] });
      proc.on("error", reject);
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`python exit ${code}`)));
    });
    rawWavs.push(wavPath);
  }

  // 2) Whisper-trim each segment.
  const trimmedDir = join(workDir, "trimmed");
  mkdirSync(trimmedDir, { recursive: true });
  const trimmedWavs: string[] = [];
  for (let i = 0; i < rawWavs.length; i++) {
    const raw = rawWavs[i];
    const rawDur = probeDuration(raw);
    const wEnd = whisperEndOfSpeech(raw, wLang);
    let finalCut: number;
    let via: string;
    if (wEnd !== null) {
      finalCut = Math.min(rawDur, wEnd + TRIM_MARGIN_SEC);
      via = "whisper";
    } else {
      finalCut = Math.max(0.1, rawDur - 0.050);
      via = "fallback";
    }
    const trimmed = join(trimmedDir, `seg_${String(i).padStart(3, "0")}.wav`);
    await ffmpeg([
      "-y", "-loglevel", "error",
      "-i", raw,
      "-t", finalCut.toFixed(3),
      "-ar", String(TARGET_SR), "-ac", "1",
      trimmed,
    ]);
    console.log(`  [${i.toString().padStart(3, "0")}] trim: raw=${rawDur.toFixed(2)}s cut=${finalCut.toFixed(2)}s via=${via}`);
    trimmedWavs.push(trimmed);
  }

  // 3) Concat with 350ms silence.
  const silencePath = join(workDir, "silence_350.wav");
  await ffmpeg([
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-t", String(SILENCE_BETWEEN_SEC),
    "-i", `anullsrc=channel_layout=mono:sample_rate=${TARGET_SR}`,
    silencePath,
  ]);
  const listPath = join(workDir, "concat_list.txt");
  const lines: string[] = [];
  for (let i = 0; i < trimmedWavs.length; i++) {
    lines.push(`file '${trimmedWavs[i]}'`);
    if (i < trimmedWavs.length - 1) lines.push(`file '${silencePath}'`);
  }
  writeFileSync(listPath, lines.join("\n"));
  const concatPath = join(workDir, "concat.wav");
  await ffmpeg([
    "-y", "-loglevel", "error",
    "-f", "concat", "-safe", "0",
    "-i", listPath,
    "-c", "copy",
    concatPath,
  ]);

  // 4) Loudnorm + MP3 encode (no ambient mixing for narrator v1).
  const finalLocal = join(workDir, "final.mp3");
  await ffmpeg([
    "-y", "-loglevel", "error",
    "-i", concatPath,
    "-af", "dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5",
    "-codec:a", "libmp3lame", "-b:a", "128k",
    finalLocal,
  ]);
  const finalDur = probeDuration(finalLocal);
  console.log(`Final mix: ${finalDur.toFixed(2)}s`);

  // 5) Upload to R2.
  const finalBuf = readFileSync(finalLocal);
  const finalFilename = `${story.slug}_${Date.now()}.mp3`;
  const uploaded = await uploadPublicObject({
    key: `media/generated/audio/${finalFilename}`,
    body: finalBuf,
    contentType: "audio/mpeg",
  });
  if (!uploaded?.url) throw new Error("R2 upload failed");

  // 6) Update DB.
  await prisma.journeyStory.update({
    where: { id: storyId },
    data: {
      audioUrl: uploaded.url,
      audioFilename: finalFilename,
      audioStatus: "ready",
      voiceId: story.voiceId,
      audioSegments: [],
      audioQaStatus: null,
      audioQaScore: null,
      audioQaNotes: null,
    },
  });
  console.log(`Uploaded: ${uploaded.url}`);

  // 7) Aeneas alignment (best-effort).
  try {
    await generateWordTimingsForStory(storyId);
    console.log("Aeneas alignment applied.");
  } catch (err) {
    console.warn(`Aeneas alignment failed (audio still works): ${err instanceof Error ? err.message : err}`);
  }

  console.log("Done.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    try {
      const storyId = process.argv[2];
      if (storyId) {
        await prisma.journeyStory.update({
          where: { id: storyId },
          data: { audioStatus: "failed" },
        }).catch(() => undefined);
      }
    } finally {
      await prisma.$disconnect();
      process.exit(1);
    }
  });
