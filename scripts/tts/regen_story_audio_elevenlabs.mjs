#!/usr/bin/env node
/**
 * Regenerate audio for German stories with audio using ElevenLabs Carl
 * (the default German voice in src/lib/elevenlabs.ts).
 *
 * Usage:
 *   node scripts/tts/regen_story_audio_elevenlabs.mjs
 *
 * One-off helper. Bypasses preview/promote, writes directly to audioUrl.
 * voiceId is left null (ElevenLabs is not a tracked engine in voiceCatalog).
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { createHash, createHmac } from "node:crypto";
import { PrismaClient } from "../../src/generated/prisma/index.js";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
if (!ELEVENLABS_API_KEY) {
  console.error("Missing ELEVENLABS_API_KEY in env");
  process.exit(1);
}

// Carl — the default German voice (per src/lib/elevenlabs.ts line 122-124)
const VOICE_ID = "Ww7Sq9tx9CCOiNOwWgsx";
const VOICE_LABEL = "elevenlabs/carl";
const MODEL_ID = "eleven_multilingual_v2";

function buildAudioNarrationText(title, storyText) {
  const plainTitle = (title ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const plainStory = (storyText ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const titleWithPause =
    plainTitle.length === 0
      ? ""
      : /[.!?…:]$/.test(plainTitle) ? plainTitle : `${plainTitle}.`;
  if (!titleWithPause) return plainStory;
  if (!plainStory) return titleWithPause;
  return `${titleWithPause}\n\n${plainStory}`;
}

function filenameFromTitle(title) {
  return (title ?? "untitled").replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
}

// ─── S3-compatible upload (mirrors src/lib/objectStorage.ts) ────────────
function trimTrailingSlash(s) { return s.replace(/\/+$/, ""); }
function toHexSha256(v) { return createHash("sha256").update(v).digest("hex"); }
function hmacSha256(key, value) { return createHmac("sha256", key).update(value).digest(); }
function encodeKeyPath(key) {
  return key.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

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
  if (!config) throw new Error("MEDIA_STORAGE_* env vars not set");
  const normalizedKey = key.replace(/^\/+/, "");
  const url = new URL(`${config.endpoint}/${encodeURIComponent(config.bucket)}/${encodeKeyPath(normalizedKey)}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = toHexSha256(body);
  const headers = new Headers({
    "content-type": contentType,
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
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
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`);
  const response = await fetch(url, { method: "PUT", headers, body: new Uint8Array(body) });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`upload failed (${response.status}): ${details.slice(0, 300)}`);
  }
  return `${config.publicBaseUrl}/${encodeKeyPath(normalizedKey)}`;
}

// ─── ElevenLabs TTS ──────────────────────────────────────────────────────
async function elevenLabsSynthesize(text, voiceId) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    }
  );
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs error (${response.status}): ${errText.slice(0, 300)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

// ─── Main ────────────────────────────────────────────────────────────────
const prisma = new PrismaClient();

async function main() {
  const stories = await prisma.journeyStory.findMany({
    where: { journey: { language: "german" }, NOT: { audioUrl: null } },
    include: { journey: true },
  });
  if (!stories.length) {
    console.log("No matching stories found.");
    return;
  }

  const totalChars = stories.reduce((sum, s) => sum + buildAudioNarrationText(s.title, s.text).length, 0);
  console.log(`Will regenerate ${stories.length} stories with ${VOICE_LABEL} (Carl, default German).`);
  console.log(`Total chars to send: ${totalChars} (~${Math.ceil(totalChars / 1000)}k).`);
  stories.forEach((s, i) => console.log(`  ${i + 1}. [${s.level}] ${s.title}`));
  console.log();

  const results = [];
  for (const [idx, story] of stories.entries()) {
    const stamp = new Date().toLocaleTimeString();
    console.log(`\n[${stamp}] (${idx + 1}/${stories.length}) ${story.title}`);
    if (!story.text || !story.title) {
      console.log("  ⚠️ skipping — missing text/title");
      continue;
    }
    const narration = buildAudioNarrationText(story.title, story.text);
    const filename = `${filenameFromTitle(story.title)}_${Date.now()}.mp3`;

    try {
      await prisma.journeyStory.update({
        where: { id: story.id },
        data: { audioStatus: "generating" },
      });
      const start = Date.now();
      const buffer = await elevenLabsSynthesize(narration, VOICE_ID);
      const took = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  ✓ elevenlabs done in ${took}s, ${buffer.length} bytes`);

      const url = await uploadObject(`media/generated/audio/${filename}`, buffer, "audio/mpeg");
      console.log(`  ✓ uploaded → ${url}`);

      await prisma.journeyStory.update({
        where: { id: story.id },
        data: {
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
      console.log(`  ✓ DB updated`);
      results.push({ id: story.id, title: story.title, url });
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      await prisma.journeyStory
        .update({ where: { id: story.id }, data: { audioStatus: "failed" } })
        .catch(() => {});
      results.push({ id: story.id, title: story.title, error: err.message });
    }
  }

  console.log("\n─── Summary ─────────────────────────────────────────");
  results.forEach((r, i) => {
    if (r.url) console.log(`${i + 1}. ✅ ${r.title}\n     ${r.url}`);
    else console.log(`${i + 1}. ❌ ${r.title}\n     ${r.error}`);
  });
}

main()
  .catch((err) => { console.error("FATAL:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
