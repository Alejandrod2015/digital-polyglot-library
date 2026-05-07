import dotenv from "dotenv";
dotenv.config({ path: "/Users/alejandrodelcarpio/digital-polyglot-library/.env" });
dotenv.config({ path: "/Users/alejandrodelcarpio/digital-polyglot-library/.env.local", override: true });
import { readFile } from "node:fs/promises";
import { createHash, createHmac } from "node:crypto";

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

const files = [
  { name: "Sebastian", path: "/tmp/voice_samples_de/tom_Sebastian.mp3" },
  { name: "Markus_Soul", path: "/tmp/voice_samples_de/tom_Markus_Soul.mp3" },
  { name: "Luca", path: "/tmp/voice_samples_de/tom_Luca.mp3" },
  { name: "Leo", path: "/tmp/voice_samples_de/tom_Leo.mp3" },
];

const ts = Date.now();
for (const f of files) {
  const buf = await readFile(f.path);
  const key = `media/voice-samples/de_tom_${f.name}_${ts}.mp3`;
  const url = await uploadObject(key, buf, "audio/mpeg");
  console.log(`${f.name}: ${url}`);
}
