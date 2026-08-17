import fs from "fs";
import { createHash, createHmac } from "crypto";

for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const endpoint = (process.env.MEDIA_STORAGE_ENDPOINT || "").replace(/\/+$/, "");
const bucket = process.env.MEDIA_STORAGE_BUCKET!;
const accessKeyId = process.env.MEDIA_STORAGE_ACCESS_KEY_ID!;
const secretAccessKey = process.env.MEDIA_STORAGE_SECRET_ACCESS_KEY!;
const region = process.env.MEDIA_STORAGE_REGION || "auto";

const KEY = process.argv[2];
if (!KEY) { console.error("usage: tsx _bustTitleCache.ts <key>"); process.exit(1); }

const hex = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const hmac = (k: Buffer | string, d: string) => createHmac("sha256", k).update(d).digest();

async function main() {
  const url = new URL(`${endpoint}/${encodeURIComponent(bucket)}/${KEY.split("/").map(encodeURIComponent).join("/")}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hex(Buffer.alloc(0));
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const sorted = Object.entries(headers).sort(([a], [b]) => a.localeCompare(b));
  const canonicalHeaders = sorted.map(([n, v]) => `${n}:${v.trim()}\n`).join("");
  const signedHeaders = sorted.map(([n]) => n).join(";");
  const canonicalRequest = ["DELETE", url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  });
  console.log(`DELETE ${KEY} → ${res.status} ${res.statusText}`);
  // confirmar 404 ahora
  const pub = (process.env.MEDIA_STORAGE_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const head = await fetch(`${pub}/${KEY}`, { method: "HEAD" });
  console.log(`HEAD público tras borrar → ${head.status} (404 = listo para regenerar)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
