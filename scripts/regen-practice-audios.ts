/**
 * One-shot: generate Piper TTS audios for every practice exercise that
 * has no `audioUrl`. Replicates the post-process chain of
 * `/api/practice/sentence-tts` (atempo 0.80 + 150ms tail silence) so
 * scripted regens produce audios identical to what the live endpoint
 * serves.
 *
 * Usage: npx tsx scripts/regen-practice-audios.ts <journeyId> <topic>
 * Optional: pass --force-overwrite to refresh ALL audios in the set
 *           (not only those with audioUrl=null). Use after bumping
 *           CACHE_VERSION.
 */
import "dotenv/config";
import dotenv from "dotenv";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma";
import { getPublicObjectUrl, uploadPublicObject } from "../src/lib/objectStorage";

dotenv.config({ path: ".env.local", override: true });

const CACHE_VERSION = "v5";
const PRACTICE_TEMPO = 0.80;

const PRACTICE_VOICES: Record<string, string> = {
  spanish: "kokoro/ef_dora",
  portuguese: "piper/pt_BR-cadu-medium",
  italian: "piper/it_IT-paola-medium",
};

const ENGINE_TO_MODAL_FN: Record<string, string> = {
  piper: "synthesize",
  kokoro: "synthesize-kokoro",
};

function modalEndpointFor(voiceId: string): string | null {
  const base = process.env.STUDIO_AUDIO_URL;
  if (!base) return null;
  const engine = voiceId.split("/", 1)[0];
  const fn = ENGINE_TO_MODAL_FN[engine];
  if (!fn) return null;
  return base.replace(/-synthesize(?=\.modal\.run\/?$)/, `-${fn}`);
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (c) => { stderr += c.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 300)}`));
    });
  });
}

async function postProcess(sourceUrl: string): Promise<Buffer> {
  const workDir = mkdtempSync(join(tmpdir(), "tts-pp-"));
  const inPath = join(workDir, "in.mp3");
  const outPath = join(workDir, "out.mp3");
  try {
    const r = await fetch(sourceUrl);
    if (!r.ok) throw new Error(`download ${r.status}`);
    writeFileSync(inPath, Buffer.from(await r.arrayBuffer()));
    await runFfmpeg([
      "-y", "-loglevel", "error",
      "-i", inPath,
      "-af", `atempo=${PRACTICE_TEMPO},apad=pad_dur=0.15`,
      "-codec:a", "libmp3lame", "-b:a", "128k",
      outPath,
    ]);
    return readFileSync(outPath);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

async function synthesize(
  sentence: string,
  language: string,
  voiceId: string
): Promise<string | null> {
  const generatedKey = `media/generated/audio/practice-${crypto
    .createHash("sha256")
    .update(`${CACHE_VERSION}|${language}||${voiceId}|${sentence}`)
    .digest("hex")
    .slice(0, 24)}.mp3`;
  const generatedFilename = generatedKey.split("/").pop()!.replace(/\.mp3$/, "");

  // Cache HEAD: if the file already exists in R2 from a previous run
  // (or from sentence-tts), skip Modal + reuse the URL.
  const cachedUrl = getPublicObjectUrl(generatedKey);
  if (cachedUrl) {
    try {
      const head = await fetch(cachedUrl, { method: "HEAD" });
      if (head.ok) return cachedUrl;
    } catch { /* fall through */ }
  }

  const modalUrl = modalEndpointFor(voiceId);
  const modalToken = process.env.STUDIO_AUDIO_TOKEN;
  if (!modalUrl || !modalToken) {
    throw new Error("STUDIO_AUDIO_URL or STUDIO_AUDIO_TOKEN missing");
  }

  const res = await fetch(modalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      _token: modalToken,
      text: sentence,
      voiceId,
      filename: generatedFilename,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Modal TTS ${res.status}: ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { url: string };

  // Post-process the Modal output (slow + pad) and upload to our cache
  // key path so it survives independent of Modal's storage.
  try {
    const processed = await postProcess(json.url);
    const uploaded = await uploadPublicObject({
      key: generatedKey,
      body: processed,
      contentType: "audio/mpeg",
    });
    return uploaded?.url ?? json.url;
  } catch (err) {
    console.warn(`  ! post-process failed, using raw Modal URL: ${err instanceof Error ? err.message : err}`);
    return json.url;
  }
}

type ExerciseRow = {
  id: string;
  sentence: string | null;
  word: string;
  type: string;
  language: string | null;
  payload: unknown;
};

/** Returns the text to send to Piper for this exercise. Prefers
 *  payload.audioClip.sentence (full sentence) over the display column
 *  `sentence` (may contain `_____`). Falls back to replacing the blank
 *  with the answer when audioClip is absent. */
function resolveTTSText(ex: ExerciseRow): string {
  const payload = (ex.payload ?? {}) as Record<string, unknown>;
  const clip = payload.audioClip as Record<string, unknown> | null | undefined;
  const clipSentence = clip && typeof clip.sentence === "string" ? clip.sentence.trim() : "";
  if (clipSentence) return clipSentence;

  const raw = (ex.sentence ?? "").trim();
  if (!raw) return "";
  const hasBlank = /_{3,}/.test(raw);
  if (!hasBlank) return raw;

  const answer =
    typeof payload.answer === "string" && payload.answer.trim()
      ? payload.answer.trim()
      : ex.word.trim();
  if (!answer) return raw;
  return raw.replace(/_{3,}/g, answer);
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force-overwrite");
  const [journeyId, topic] = args.filter((a) => !a.startsWith("--"));
  if (!journeyId || !topic) {
    console.error("usage: tsx regen-practice-audios.ts <journeyId> <topic> [--force-overwrite]");
    process.exit(1);
  }

  const p = new PrismaClient();
  const stories = await p.journeyStory.findMany({
    where: { journeyId, topic },
    select: {
      id: true,
      title: true,
      voiceId: true,
      practiceVoiceId: true,
      journey: { select: { language: true } },
      practiceSet: {
        select: {
          exercises: {
            where: force ? {} : { audioUrl: null },
            select: { id: true, sentence: true, word: true, type: true, language: true, payload: true },
          },
        },
      },
    },
  });

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const story of stories) {
    const language = story.journey.language;
    const defaultVoice = PRACTICE_VOICES[language.toLowerCase()];
    if (!defaultVoice) {
      console.warn(`[${story.title}] no licence-clean voice for ${language}, skipping`);
      continue;
    }
    const voiceId = story.voiceId && PRACTICE_VOICES[language.toLowerCase()] === story.voiceId
      ? story.voiceId
      : defaultVoice;

    const pending = story.practiceSet?.exercises ?? [];
    console.log(`[${story.title}] ${pending.length} pending → ${voiceId}`);
    for (const ex of pending) {
      // listen_choose stores just the word in `sentence`; speaking that
      // alone works but produces a robotic 1-word clip. Keep as-is for
      // backwards compatibility with the mobile flow.
      //
      // For fill_blank the column `sentence` is the
      // display-form ("Mmm, _____!"). Sending that to Piper makes it skip
      // (or literally read) the underscores, so the audio ends up missing
      // the target word. The generator already stores the FULL sentence
      // in `payload.audioClip.sentence` — prefer that when present, and
      // fall back to replacing `_____` with the answer when not.
      const ttsText = resolveTTSText(ex);
      if (!ttsText) { skipped++; continue; }
      try {
        const url = await synthesize(ttsText, language, voiceId);
        if (!url) { failed++; continue; }
        await p.storyPracticeExercise.update({
          where: { id: ex.id },
          data: { audioUrl: url },
        });
        ok++;
      } catch (err) {
        failed++;
        console.warn(`  ✗ [${ex.word}] ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log(`\nDone. ok=${ok} skipped=${skipped} failed=${failed}`);
  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
