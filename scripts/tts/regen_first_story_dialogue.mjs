#!/usr/bin/env node
/**
 * Rewrite the first German story (Café in Kreuzberg) as a multi-voice dialogue.
 * Narrator (Moritz Morgenstern) reads the title + opening context paragraph;
 * Anna (ENNIAH) and Tom (Simon Sunday) carry the dialogue. Body text uses
 * `Speaker: line` per turn (no quotes — cleaner reader display).
 *
 * Steps:
 *  1. Synthesize each spec segment via ElevenLabs (sequential — 5-concurrent cap).
 *  2. Concatenate with 0.4s silence between segments via ffmpeg.
 *  3. Upload merged MP3.
 *  4. Update JourneyStory: text, dialogueSpec, audioUrl, audioFilename, wordCount.
 *  5. Regenerate vocab via the local /api/generate-vocab endpoint so highlighting
 *     reflects the new text. Falls back gracefully if dev server is offline.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import { PrismaClient } from "../../src/generated/prisma/index.js";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
if (!ELEVENLABS_API_KEY) { console.error("Missing ELEVENLABS_API_KEY"); process.exit(1); }
const VOCAB_API = process.env.VOCAB_API ?? "http://localhost:3000/api/generate-vocab";

// ─── Cast ───────────────────────────────────────────────────────────────
const VOICE_NARRATOR = "Ww7Sq9tx9CCOiNOwWgsx"; // Moritz Morgenstern (DE, m, narrative)
const VOICE_ANNA     = "WHaUUVTDq47Yqc9aDbkH"; // ENNIAH (DE, f, educational)
// Liam (premade EN, energetic) replaces Simon Sunday (DE, young) — Simon felt
// monotone in dialogue. Premade voices speak German via eleven_multilingual_v2.
const VOICE_TOM      = "TX3LPaxmHKxFdv7VOQHJ"; // Liam (premade, m young)

const STORY_TITLE = "Café in Kreuzberg";

// Opening narration: title + scene-setting paragraph. Speaker labels (Anna:/Tom:)
// belong only to the displayed text, never to the audio.
const NARRATION_PARAGRAPH =
  "Es ist Samstagnachmittag in Berlin. Im kleinen Café in Kreuzberg ist es voll und gemütlich. " +
  "Viele Menschen trinken Kaffee und lesen Zeitung. Anna kommt herein und sucht einen freien Platz, " +
  "aber alle Tische sind besetzt. Nur ein junger Mann sitzt allein am Fenster mit einem Buch. " +
  "Anna geht freundlich zu ihm.";

// 9 dialogue turns, each ~20-30 words — substantive exchanges, no one-liners.
const DIALOGUE = [
  { speaker: "Anna", voice: VOICE_ANNA, text:
    "Entschuldigung, alle anderen Tische sind voll. Ist der Platz neben dir noch frei? Ich möchte gern einen Kaffee trinken und vielleicht ein Stück Kuchen essen." },
  { speaker: "Tom", voice: VOICE_TOM, text:
    "Ja, klar! Setz dich gern, der Stuhl ist frei. Ich lese nur ein bisschen, aber ich freue mich über Gesellschaft. Ich heiße übrigens Tom, ich bin neu in Berlin." },
  { speaker: "Anna", voice: VOICE_ANNA, text:
    "Schön, dich zu treffen, Tom! Ich bin Anna. Du bist also neu hier? Ich wohne schon zwei Jahre in Kreuzberg und finde die Stadt wunderbar. Woher kommst du?" },
  { speaker: "Tom", voice: VOICE_TOM, text:
    "Ich komme aus München. Dort lebt meine Familie. Ich bin seit einer Woche in Berlin und kenne fast niemanden. Die Stadt ist groß und manchmal schwierig." },
  { speaker: "Anna", voice: VOICE_ANNA, text:
    "Ich arbeite in einer Buchhandlung am Mehringdamm. Wir verkaufen Romane und Reisebücher. Es ist ein schöner Job, weil ich Bücher liebe." },
  { speaker: "Tom", voice: VOICE_TOM, text:
    "Ich studiere Architektur. Mein Studium beginnt nächsten Monat. Bis dahin lerne ich die Stadt kennen. Hast du vielleicht ein paar Tipps für mich?" },
  { speaker: "Anna", voice: VOICE_ANNA, text:
    "Am Sonntag gehe ich oft zum Markt am Boxhagener Platz. Es gibt frisches Brot, Käse, Obst und manchmal Musik im Park. Möchtest du mitkommen?" },
  { speaker: "Tom", voice: VOICE_TOM, text:
    "Sehr gern! Hier ist meine Telefonnummer. Schreib mir am Sonntag, dann komme ich. Vielen Dank, Anna!" },
  { speaker: "Anna", voice: VOICE_ANNA, text:
    "Super! Bis Sonntag, Tom. Ich freue mich!" },
];

// Audio segments: narrator first (with title), then dialogue lines verbatim.
const SPEC = [
  { speaker: "Narrator", voice: VOICE_NARRATOR, text: `${STORY_TITLE}.\n\n${NARRATION_PARAGRAPH}` },
  ...DIALOGUE,
];

// Display text: opening paragraph (no title — title is stored separately on
// the row), blank line, then `Speaker: line` per turn.
const STORY_TEXT = [
  NARRATION_PARAGRAPH,
  "",
  ...DIALOGUE.map((s) => `${s.speaker}: ${s.text}`),
].join("\n");

const DIALOGUE_SPEC = SPEC.map((s) => ({
  voice: `elevenlabs/${s.voice}`,
  speaker: s.speaker,
  text: s.text,
}));

// ─── ElevenLabs synthesis ───────────────────────────────────────────────
async function synthesize(text, voiceId) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.8 },
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}

// ─── ffmpeg helpers ──────────────────────────────────────────────────────
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    const errChunks = [];
    child.stderr.on("data", (c) => errChunks.push(c));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(errChunks).toString().slice(-500)}`));
    });
    child.on("error", reject);
  });
}

async function makeSilenceMp3(outPath, durationSec) {
  await runFfmpeg([
    "-y", "-f", "lavfi",
    "-i", `anullsrc=channel_layout=mono:sample_rate=44100`,
    "-t", String(durationSec),
    "-b:a", "128k", outPath, "-loglevel", "error",
  ]);
}

async function concatMp3s(parts, outPath) {
  const args = ["-y"];
  parts.forEach((p) => { args.push("-i", p); });
  const filter = parts.map((_, i) => `[${i}:a]`).join("") + `concat=n=${parts.length}:v=0:a=1[out]`;
  args.push("-filter_complex", filter, "-map", "[out]", "-b:a", "128k", outPath, "-loglevel", "error");
  await runFfmpeg(args);
}

// ─── S3 upload (mirrors src/lib/objectStorage.ts) ────────────────────────
function trimTrailingSlash(s) { return s.replace(/\/+$/, ""); }
function toHexSha256(v) { return createHash("sha256").update(v).digest("hex"); }
function hmacSha256(key, value) { return createHmac("sha256", key).update(value).digest(); }
function encodeKeyPath(key) { return key.split("/").filter(Boolean).map(encodeURIComponent).join("/"); }
function getStorageConfig() {
  const endpoint = trimTrailingSlash((process.env.MEDIA_STORAGE_ENDPOINT ?? "").trim());
  const bucket = (process.env.MEDIA_STORAGE_BUCKET ?? "").trim();
  const accessKeyId = (process.env.MEDIA_STORAGE_ACCESS_KEY_ID ?? "").trim();
  const secretAccessKey = (process.env.MEDIA_STORAGE_SECRET_ACCESS_KEY ?? "").trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint, bucket, accessKeyId, secretAccessKey,
    publicBaseUrl:
      trimTrailingSlash((process.env.MEDIA_STORAGE_PUBLIC_BASE_URL ?? "").trim()) ||
      `${endpoint}/${encodeURIComponent(bucket)}`,
    region: (process.env.MEDIA_STORAGE_REGION ?? "auto").trim(),
  };
}
async function uploadObject(key, body, contentType) {
  const config = getStorageConfig();
  if (!config) throw new Error("MEDIA_STORAGE_* not set");
  const normalizedKey = key.replace(/^\/+/, "");
  const url = new URL(`${config.endpoint}/${encodeURIComponent(config.bucket)}/${encodeKeyPath(normalizedKey)}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = toHexSha256(body);
  const headers = new Headers({
    "content-type": contentType, host: url.host,
    "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate,
    "cache-control": "public, max-age=31536000, immutable",
  });
  const sortedHeaders = Array.from(headers.entries()).sort(([a], [b]) => a.localeCompare(b));
  const canonicalHeaders = sortedHeaders.map(([k, v]) => `${k}:${v.trim()}\n`).join("");
  const signedHeaders = sortedHeaders.map(([k]) => k).join(";");
  const canonicalRequest = ["PUT", url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, toHexSha256(canonicalRequest)].join("\n");
  const signingKey = hmacSha256(
    hmacSha256(hmacSha256(hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"),
    "aws4_request"
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  headers.set("authorization",
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`);
  const response = await fetch(url, { method: "PUT", headers, body: new Uint8Array(body) });
  if (!response.ok) throw new Error(`upload ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return `${config.publicBaseUrl}/${encodeKeyPath(normalizedKey)}`;
}

// ─── Vocab regeneration via local Next.js endpoint ───────────────────────
async function regenerateVocab(text, language, variant, cefrLevel, topic) {
  const r = await fetch(VOCAB_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // generate-vocab gates on Origin via buildSanityCorsHeaders; sanity.io is allowed.
      "Origin": "https://www.sanity.io",
    },
    body: JSON.stringify({
      text, language, variant, cefrLevel, topic,
      focus: "verbs", minItems: 15, maxItems: 22,
    }),
  });
  if (!r.ok) throw new Error(`vocab ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  if (!Array.isArray(data?.vocab) || data.vocab.length === 0) {
    throw new Error("generate-vocab returned empty vocab");
  }
  return data.vocab;
}

// ─── Main ────────────────────────────────────────────────────────────────
const prisma = new PrismaClient();

async function main() {
  const story = await prisma.journeyStory.findFirst({
    where: { journey: { language: "german" }, title: STORY_TITLE },
    include: { journey: true },
  });
  if (!story) throw new Error(`Story not found: ${STORY_TITLE}`);
  console.log(`Target: ${story.id} | ${story.title} | level=${story.level} | topic=${story.topic}`);

  const tempDir = await mkdtemp(join(tmpdir(), "tts-dialogue-"));
  console.log(`tmp: ${tempDir}`);

  try {
    await prisma.journeyStory.update({
      where: { id: story.id }, data: { audioStatus: "generating" },
    });

    const silencePath = join(tempDir, "silence.mp3");
    await makeSilenceMp3(silencePath, 0.4);

    console.log(`Synthesizing ${SPEC.length} segments via ElevenLabs (sequential)...`);
    const segPaths = [];
    for (let i = 0; i < SPEC.length; i += 1) {
      const s = SPEC[i];
      const buf = await synthesize(s.text, s.voice);
      const p = join(tempDir, `seg_${String(i).padStart(3, "0")}.mp3`);
      await writeFile(p, buf);
      process.stdout.write(`  ${i + 1}/${SPEC.length} ${s.speaker.padEnd(8)} ${buf.length} bytes\n`);
      segPaths.push(p);
    }

    const playlist = [];
    segPaths.forEach((p, i) => {
      playlist.push(p);
      if (i < segPaths.length - 1) playlist.push(silencePath);
    });
    const finalPath = join(tempDir, "final.mp3");
    console.log(`Concatenating ${playlist.length} parts...`);
    await concatMp3s(playlist, finalPath);

    const buffer = await readFile(finalPath);
    const filename = `${STORY_TITLE.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_")}_dialogue_${Date.now()}.mp3`;
    const url = await uploadObject(`media/generated/audio/${filename}`, buffer, "audio/mpeg");
    console.log(`Uploaded → ${url} (${buffer.length} bytes)`);

    const wordCount = STORY_TEXT.split(/\s+/).filter(Boolean).length;
    console.log(`New story word count: ${wordCount}`);

    // Update text + audio first (vocab is regenerated separately so a vocab
    // failure doesn't cost us the audio work).
    await prisma.journeyStory.update({
      where: { id: story.id },
      data: {
        text: STORY_TEXT,
        wordCount,
        dialogueSpec: DIALOGUE_SPEC,
        audioUrl: url,
        audioFilename: filename,
        audioSegments: [],
        audioStatus: "ready",
        voiceId: null,
        audioUrlPreview: null,
        audioFilenamePreview: null,
        audioQaStatus: null,
        audioQaScore: null,
        audioQaNotes: null,
      },
    });
    console.log("✓ DB updated (text + audio).");

    // Regenerate vocab. Strip "Speaker:" prefixes so the LLM sees clean prose
    // and doesn't pick up character names as vocab entries.
    if (process.env.SKIP_VOCAB === "1") {
      console.log("SKIP_VOCAB=1 set, leaving existing vocab untouched.");
      return;
    }
    const cleanText = STORY_TEXT.replace(/^[A-ZÄÖÜ][a-zäöüß]+:\s/gm, "");
    console.log(`Regenerating vocab via ${VOCAB_API}...`);
    try {
      const vocab = await regenerateVocab(
        cleanText,
        story.journey.language,
        story.journey.variant,
        story.level,
        story.topic
      );
      await prisma.journeyStory.update({
        where: { id: story.id },
        data: { vocab, vocabCount: vocab.length },
      });
      console.log(`✓ vocab updated (${vocab.length} items)`);
      vocab.slice(0, 25).forEach((v, i) =>
        console.log(`    ${i + 1}. ${v.surface || v.word} — ${(v.definition || "").slice(0, 70)}`)
      );
    } catch (err) {
      console.warn(`⚠ vocab regen failed (${err.message}). Run manually from Studio → Regenerate Vocab.`);
    }
  } catch (err) {
    console.error("FAILED:", err.message);
    await prisma.journeyStory
      .update({ where: { id: story.id }, data: { audioStatus: "failed" } })
      .catch(() => {});
    throw err;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
