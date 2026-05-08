/**
 * Re-generate multi-voice audio for Tinto + Carnitas with phantom-syllable fix.
 *
 * For each segment:
 *   1. Generate raw WAV via Python (kokoro or chatterbox).
 *   2. Convert to small MP3 and upload to R2 temp path.
 *   3. POST to Modal align endpoint with audioUrl + plain text + language=spanish.
 *   4. Find max endSec across aligned tokens; trim WAV at endSec + 30 ms.
 *
 * Then concat all trimmed WAVs with 350 ms of silence between, mix the
 * language-matched ambient at 10% volume, normalize loudness, encode MP3,
 * upload final to R2, update DB.
 */
import { prisma } from "@/lib/prisma";
import { uploadPublicObject } from "@/lib/objectStorage";
import { spawn, spawnSync } from "child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join, basename } from "path";
import { randomUUID } from "crypto";

const REPO = "/Users/alejandrodelcarpio/digital-polyglot-library";
const VENV = `${REPO}/scripts/tts/.venv-chatterbox`;
const PY = `${VENV}/bin/python`;
const GEN_SCRIPT = "/tmp/generate_raw_segments.py";
const AMBIENT_BY_TAG: Record<string, string> = {
  cafeteria: `${REPO}/scripts/tts/ambience/cafeteria_es.mp3`,
  mercado:   `${REPO}/scripts/tts/ambience/mercado_es.mp3`,
};
const AMBIENT_VOLUME = 0.10;
const TRIM_MARGIN_SEC = 0.030;     // keep 30 ms after the last aligned word
const SILENCE_BETWEEN_SEC = 0.350; // 350 ms gap between segments

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

/**
 * Whisper.cpp-based phantom detector. Run whisper-cli at word granularity
 * (-ml 1) on the segment, get per-word timestamps. The end of the LAST
 * recognized word + 30 ms is the true end of speech — anything after is
 * either silence or a hallucinated phantom (which whisper drops because
 * it doesn't transcribe to anything that matches the expected text).
 *
 * Returns null if whisper failed or returned nothing usable.
 */
const WHISPER_BIN = "/opt/homebrew/bin/whisper-cli";
const WHISPER_MODEL = `${REPO}/scripts/tts/whisper-models/ggml-small.bin`;

function whisperEndOfSpeech(wavPath: string): number | null {
  const tmpPrefix = wavPath.replace(/\.wav$/, "_w");
  const r = spawnSync(WHISPER_BIN, [
    "-m", WHISPER_MODEL,
    "-f", wavPath,
    "-l", "es",
    "-ml", "1",       // 1-word segments → word-level timestamps
    "-oj",            // JSON output
    "-of", tmpPrefix, // writes <tmpPrefix>.json
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const jsonPath = `${tmpPrefix}.json`;
  if (r.status !== 0 || !existsSync(jsonPath)) return null;
  try {
    const data = JSON.parse(readFileSync(jsonPath, "utf-8"));
    const items: Array<{ offsets?: { from?: number; to?: number }; text?: string }> =
      Array.isArray(data?.transcription) ? data.transcription : [];
    let lastWordEnd = -1;
    for (const it of items) {
      // Skip pure-punctuation tokens which whisper sometimes emits with
      // collapsed offsets equal to the previous word's end. We want the
      // last *word* boundary.
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
    try { rmSync(jsonPath); } catch {}
  }
}

function resolveAlignUrl(): string {
  const explicit = (process.env.STUDIO_AUDIO_ALIGN_URL || "").trim();
  if (explicit) return explicit;
  const synth = (process.env.STUDIO_AUDIO_URL || "").trim();
  if (!synth) throw new Error("Neither STUDIO_AUDIO_ALIGN_URL nor STUDIO_AUDIO_URL set");
  if (synth.includes("-synthesize.modal.run")) {
    return synth.replace("-synthesize.modal.run", "-align.modal.run");
  }
  throw new Error("STUDIO_AUDIO_URL not in expected synth format");
}

async function alignAndGetEndSec(audioUrl: string, text: string): Promise<number | null> {
  const url = resolveAlignUrl();
  const token = (process.env.STUDIO_AUDIO_TOKEN || "").trim();
  if (!token) throw new Error("STUDIO_AUDIO_TOKEN not set");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ _token: token, audioUrl, text, language: "spanish" }),
  });
  if (!res.ok) {
    console.warn(`  align ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  const data: any = await res.json();
  const tokens = Array.isArray(data?.tokens) ? data.tokens : [];
  let maxEnd = -1;
  for (const t of tokens) {
    if (typeof t.endSec === "number" && Number.isFinite(t.endSec)) {
      if (t.endSec > maxEnd) maxEnd = t.endSec;
    }
  }
  return maxEnd >= 0 ? maxEnd : null;
}

async function processSlot(slot: number) {
  console.log(`\n========== slot ${slot} ==========`);
  const journey = await prisma.journey.findFirst({
    where: { language: "spanish", variant: "latam" },
  });
  if (!journey) throw new Error("Journey not found");
  const story = await prisma.journeyStory.findFirst({
    where: { journeyId: journey.id, level: "a1", topic: "food-everyday-life", slotIndex: slot },
  });
  if (!story) throw new Error(`Story slot ${slot} not found`);
  console.log(`story=${story.slug} ambient=${story.ambientTag}`);

  const workDir = `/tmp/regen/slot${slot}`;
  // Wipe ONLY the intermediate dirs; keep raw segments + manifest so Python
  // can hit its cache and we don't pay 5-10 min of Kokoro+Chatterbox CPU again.
  rmSync(`${workDir}/trimmed`, { recursive: true, force: true });
  rmSync(`${workDir}/harmonized`, { recursive: true, force: true });
  for (const f of ["concat.wav", "mixed.wav", "final.mp3", "concat_list.txt", "silence_350.wav"]) {
    rmSync(`${workDir}/${f}`, { force: true });
  }
  // Also drop stale per-segment _align.mp3 derivatives — they get re-emitted.
  if (existsSync(workDir)) {
    for (const name of readdirSync(workDir)) {
      if (name.endsWith("_align.mp3")) rmSync(`${workDir}/${name}`, { force: true });
    }
  }
  mkdirSync(workDir, { recursive: true });

  // 1) Generate raw segment WAVs via Python.
  console.log("Generating raw segments via Python (kokoro + chatterbox)...");
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(PY, [GEN_SCRIPT, String(slot)], { stdio: "inherit" });
    proc.on("error", reject);
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`gen exit ${code}`)));
  });

  const manifestPath = `${workDir}/manifest.json`;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Array<{
    idx: number; voice: string; text: string; wav: string; sr: number;
  }>;

  // 2) For each segment: convert to MP3, upload, align, trim WAV.
  const trimmedDir = `${workDir}/trimmed`;
  mkdirSync(trimmedDir, { recursive: true });
  const tmpR2Keys: string[] = [];

  for (const seg of manifest) {
    const rawDur = probeDuration(seg.wav);
    const isAR = seg.voice.startsWith("chatterbox/") || seg.voice.startsWith("qwen/");

    let finalCut: number = rawDur;
    let cutSource = "raw";

    if (isAR) {
      // Autoregressive engines: whisper gives true end-of-speech (it
      // transcribes only recognizable content, so any hallucinated phantom
      // tail past the real text is implicitly dropped). No Modal upload.
      const wEnd = whisperEndOfSpeech(seg.wav);
      if (wEnd !== null) {
        finalCut = Math.min(rawDur, wEnd + TRIM_MARGIN_SEC);
        cutSource = "whisper";
      } else {
        finalCut = Math.max(0.1, rawDur - 0.050);
        cutSource = "whisper-fail-fallback";
      }
    } else {
      // Kokoro / Piper are non-AR with no phantom; aeneas word-level
      // alignment via Modal is sufficient.
      const mp3Path = `${workDir}/seg_${String(seg.idx).padStart(3, "0")}_align.mp3`;
      await ffmpeg(["-y", "-loglevel", "error", "-i", seg.wav, "-codec:a", "libmp3lame", "-b:a", "96k", mp3Path]);
      const buf = readFileSync(mp3Path);
      const r2Key = `media/tmp/align/${randomUUID()}.mp3`;
      const uploaded = await uploadPublicObject({ key: r2Key, body: buf, contentType: "audio/mpeg" });
      if (!uploaded?.url) throw new Error(`tmp upload failed for seg ${seg.idx}`);
      tmpR2Keys.push(r2Key);
      let endSec: number | null = null;
      try { endSec = await alignAndGetEndSec(uploaded.url, seg.text); } catch (err) {
        console.warn(`  align error: ${err instanceof Error ? err.message : err}`);
      }
      if (endSec !== null) {
        finalCut = Math.min(rawDur, endSec + TRIM_MARGIN_SEC);
        cutSource = "aeneas";
      } else {
        finalCut = Math.max(0.1, rawDur - 0.050);
        cutSource = "aeneas-fail-fallback";
      }
    }

    console.log(`  [${seg.idx.toString().padStart(3, "0")}] ${seg.voice.split("/")[0].padEnd(11)} raw=${rawDur.toFixed(2)} cut=${finalCut.toFixed(2)} via=${cutSource} (saved ${(rawDur - finalCut).toFixed(2)}s)`);

    const trimmedPath = `${trimmedDir}/seg_${String(seg.idx).padStart(3, "0")}.wav`;
    await ffmpeg([
      "-y", "-loglevel", "error",
      "-i", seg.wav,
      "-t", finalCut.toFixed(3),
      "-ar", String(seg.sr), "-ac", "1",
      trimmedPath,
    ]);
  }

  // 3) Concat trimmed segments with 350 ms silence between.
  // First: harmonize all to the same sample rate (use 24000) for clean concat.
  const harmonized = `${workDir}/harmonized`;
  mkdirSync(harmonized, { recursive: true });
  const orderedPaths: string[] = [];
  for (const seg of manifest) {
    const inPath = `${trimmedDir}/seg_${String(seg.idx).padStart(3, "0")}.wav`;
    const outPath = `${harmonized}/seg_${String(seg.idx).padStart(3, "0")}.wav`;
    await ffmpeg(["-y", "-loglevel", "error", "-i", inPath, "-ar", "24000", "-ac", "1", outPath]);
    orderedPaths.push(outPath);
  }

  // Generate a 350 ms silence file at 24000 Hz mono.
  const silencePath = `${workDir}/silence_350.wav`;
  await ffmpeg([
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-t", String(SILENCE_BETWEEN_SEC),
    "-i", "anullsrc=channel_layout=mono:sample_rate=24000",
    silencePath,
  ]);

  // Build concat list: seg_000, silence, seg_001, silence, ..., seg_N
  const listPath = `${workDir}/concat_list.txt`;
  const lines: string[] = [];
  for (let i = 0; i < orderedPaths.length; i++) {
    lines.push(`file '${orderedPaths[i]}'`);
    if (i < orderedPaths.length - 1) lines.push(`file '${silencePath}'`);
  }
  writeFileSync(listPath, lines.join("\n"));

  const concatPath = `${workDir}/concat.wav`;
  await ffmpeg([
    "-y", "-loglevel", "error",
    "-f", "concat", "-safe", "0",
    "-i", listPath,
    "-c", "copy",
    concatPath,
  ]);

  // 4) Mix ambient at 10% (if any) + loudnorm + MP3 encode in a single pass.
  // The named [mix] output must feed loudnorm in the same filter graph, then
  // ffmpeg's default mapping picks up loudnorm's output.
  const finalLocal = `${workDir}/final.mp3`;
  const ambientPath = story.ambientTag ? AMBIENT_BY_TAG[story.ambientTag] : null;
  if (ambientPath && existsSync(ambientPath)) {
    console.log(`Mixing ambient: ${story.ambientTag} @ ${AMBIENT_VOLUME} + loudnorm + mp3`);
    const filter =
      `[1:a]volume=${AMBIENT_VOLUME},afade=t=in:st=0:d=1[a1];` +
      `[0:a][a1]amix=inputs=2:duration=first:dropout_transition=2[mix];` +
      `[mix]dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5`;
    await ffmpeg([
      "-y", "-loglevel", "error",
      "-i", concatPath,
      "-stream_loop", "-1", "-i", ambientPath,
      "-filter_complex", filter,
      "-codec:a", "libmp3lame", "-b:a", "128k",
      finalLocal,
    ]);
  } else {
    await ffmpeg([
      "-y", "-loglevel", "error",
      "-i", concatPath,
      "-af", "dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5",
      "-codec:a", "libmp3lame", "-b:a", "128k",
      finalLocal,
    ]);
  }
  const finalDur = probeDuration(finalLocal);
  console.log(`Final mix duration: ${finalDur.toFixed(2)}s`);

  // 6) Upload final to R2.
  const finalBuf = readFileSync(finalLocal);
  const finalFilename = `${story.slug}_${Date.now()}.mp3`;
  const finalUploaded = await uploadPublicObject({
    key: `media/generated/audio/${finalFilename}`,
    body: finalBuf,
    contentType: "audio/mpeg",
  });
  if (!finalUploaded?.url) throw new Error("final upload failed");

  // 7) Update DB.
  await prisma.journeyStory.update({
    where: { id: story.id },
    data: {
      audioUrl: finalUploaded.url,
      audioFilename: finalFilename,
      audioStatus: "ready",
    },
  });
  console.log(`✅ slot ${slot} updated. audioUrl=${finalUploaded.url}`);

  // 8) Best-effort cleanup of tmp R2 keys (alignment audios).
  // Skipped: requires DELETE permission which uploadPublicObject doesn't expose.
  // The tmp/align/ prefix can be lifecycle-cleaned later.
}

async function main() {
  await processSlot(0);
  await processSlot(1);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
