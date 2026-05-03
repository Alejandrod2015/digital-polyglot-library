#!/usr/bin/env node
/**
 * Regenerate audio for a list of JourneyStory rows using a specific voice.
 *
 * Usage:
 *   node scripts/tts/regen_story_audio.mjs --voice "bark/de_speaker_4" \
 *       --story-ids id1,id2,id3
 *
 *   node scripts/tts/regen_story_audio.mjs --voice "bark/de_speaker_4" \
 *       --language german --with-audio-only
 *
 * Bypasses the preview/promote flow: writes directly to audioUrl + audioFilename
 * and sets voiceId on each story.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, createHmac } from "node:crypto";
import { PrismaClient } from "../../src/generated/prisma/index.js";

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) {
      const k = cur.slice(2);
      const v = arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "true";
      acc.push([k, v]);
    }
    return acc;
  }, [])
);

const VOICE = args.voice;
if (!VOICE) {
  console.error("Missing --voice <engine/name> (e.g. bark/de_speaker_4)");
  process.exit(1);
}
const STORY_IDS = args["story-ids"] ? args["story-ids"].split(",").map((s) => s.trim()) : null;
const LANGUAGE = args.language ?? null;
const WITH_AUDIO_ONLY = args["with-audio-only"] === "true";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const projectRoot = "/Users/alejandrodelcarpio/digital-polyglot-library";
const pythonBinary = join(
  projectRoot,
  ".claude",
  "worktrees",
  "flamboyant-knuth-7f5266",
  "scripts",
  "tts",
  ".venv",
  "bin",
  "python"
);
const ttsScript = join(
  projectRoot,
  ".claude",
  "worktrees",
  "flamboyant-knuth-7f5266",
  "scripts",
  "tts",
  "generate_audio.py"
);

const LANGUAGE_TO_KOKORO = {
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

function buildAudioNarrationText(title, storyText) {
  const plainTitle = (title ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const plainStory = (storyText ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const titleWithPause =
    plainTitle.length === 0
      ? ""
      : /[.!?…:]$/.test(plainTitle)
        ? plainTitle
        : `${plainTitle}.`;
  if (!titleWithPause) return plainStory;
  if (!plainStory) return titleWithPause;
  return `${titleWithPause}\n\n${plainStory}`;
}

function filenameFromTitle(title) {
  return (title ?? "untitled").replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
}

function runPython({ text, lang, outputPath, voiceId }) {
  return new Promise((resolve, reject) => {
    const argv = [
      ttsScript,
      "--lang", lang,
      "--text", text,
      "--voice-id", voiceId,
      "--postprocess",
      "-o", outputPath,
    ];
    const child = spawn(pythonBinary, argv, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: projectRoot,
    });
    const stderrChunks = [];
    child.stdout.on("data", (chunk) => process.stdout.write(`[py] ${chunk}`));
    child.stderr.on("data", (chunk) => {
      stderrChunks.push(chunk);
      // Echo non-progress lines so we can see meaningful errors
      const s = chunk.toString();
      if (!s.includes("it/s") && !s.match(/^\s*\d+%\|/)) {
        process.stderr.write(`[py:err] ${s}`);
      }
    });
    child.on("error", (err) => reject(new Error(`spawn failed: ${err.message}`)));
    child.on("close", (code) => {
      if (code === 0) return resolve();
      const stderr = Buffer.concat(stderrChunks).toString();
      reject(new Error(`Python exited ${code}. tail: ${stderr.slice(-500)}`));
    });
  });
}

// ─── S3-compatible upload (ported from src/lib/objectStorage.ts) ────────────
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

// ─── Main ────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient();

async function main() {
  let stories;
  if (STORY_IDS) {
    stories = await prisma.journeyStory.findMany({
      where: { id: { in: STORY_IDS } },
      include: { journey: true },
    });
  } else if (LANGUAGE) {
    stories = await prisma.journeyStory.findMany({
      where: {
        journey: { language: LANGUAGE },
        ...(WITH_AUDIO_ONLY ? { NOT: { audioUrl: null } } : {}),
      },
      include: { journey: true },
    });
  } else {
    console.error("Need either --story-ids or --language");
    process.exit(1);
  }

  if (!stories.length) {
    console.log("No stories matched.");
    return;
  }

  console.log(`Will regenerate audio for ${stories.length} stories using ${VOICE}\n`);
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
    const langKey = story.journey.language.toLowerCase();
    const kokoroLang = LANGUAGE_TO_KOKORO[langKey] ?? "es";
    const narration = buildAudioNarrationText(story.title, story.text);
    const filename = `${filenameFromTitle(story.title)}_${Date.now()}.mp3`;

    const tempDir = await mkdtemp(join(tmpdir(), "tts-"));
    const tempFile = join(tempDir, filename);
    try {
      await prisma.journeyStory.update({
        where: { id: story.id },
        data: { audioStatus: "generating" },
      });
      const start = Date.now();
      await runPython({ text: narration, lang: kokoroLang, outputPath: tempFile, voiceId: VOICE });
      const took = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  ✓ python done in ${took}s`);

      const buffer = await readFile(tempFile);
      const url = await uploadObject(`media/generated/audio/${filename}`, buffer, "audio/mpeg");
      console.log(`  ✓ uploaded → ${url}`);

      await prisma.journeyStory.update({
        where: { id: story.id },
        data: {
          audioUrl: url,
          audioFilename: filename,
          audioSegments: [],
          audioStatus: "ready",
          voiceId: VOICE,
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
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  console.log("\n─── Summary ─────────────────────────────────────────");
  results.forEach((r, i) => {
    if (r.url) console.log(`${i + 1}. ✅ ${r.title}\n     ${r.url}`);
    else console.log(`${i + 1}. ❌ ${r.title}\n     ${r.error}`);
  });
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
