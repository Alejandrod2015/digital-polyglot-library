import { createHash, createHmac } from "crypto";

type UploadPublicObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
};

type UploadPublicObjectResult = {
  key: string;
  url: string;
};

type ObjectStorageConfig = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  region: string;
};

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function toHexSha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmacSha256(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function encodeKeyPath(key: string): string {
  return key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function getObjectStorageConfig(): ObjectStorageConfig | null {
  const endpoint = trimTrailingSlash(readEnv("MEDIA_STORAGE_ENDPOINT"));
  const bucket = readEnv("MEDIA_STORAGE_BUCKET");
  const accessKeyId = readEnv("MEDIA_STORAGE_ACCESS_KEY_ID");
  const secretAccessKey = readEnv("MEDIA_STORAGE_SECRET_ACCESS_KEY");

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl:
      trimTrailingSlash(readEnv("MEDIA_STORAGE_PUBLIC_BASE_URL")) ||
      `${endpoint}/${encodeURIComponent(bucket)}`,
    region: readEnv("MEDIA_STORAGE_REGION") || "auto",
  };
}

// The private audio bucket. Same R2 account and same API token as the public
// one (the token is scoped to the account, not to a single bucket), so only
// the bucket name changes. When MEDIA_PRIVATE_BUCKET is unset we fall back to
// the public bucket, which keeps every code path working before the bucket
// exists in Cloudflare.
//
// `publicBaseUrl` is deliberately the PUBLIC one: the canonical URL we store
// in the database never changes, whichever bucket holds the bytes.
function getPrivateObjectStorageConfig(): ObjectStorageConfig | null {
  const config = getObjectStorageConfig();
  if (!config) return null;

  const privateBucket = readEnv("MEDIA_PRIVATE_BUCKET");
  if (!privateBucket) return config;

  return { ...config, bucket: privateBucket };
}

export function isPrivateBucketConfigured(): boolean {
  return readEnv("MEDIA_PRIVATE_BUCKET") !== "";
}

export function getPrivateBucketName(): string | null {
  const config = getPrivateObjectStorageConfig();
  return config?.bucket ?? null;
}

export function getPublicBucketName(): string | null {
  const config = getObjectStorageConfig();
  return config?.bucket ?? null;
}

function buildPublicUrl(config: ObjectStorageConfig, key: string): string {
  return `${config.publicBaseUrl}/${encodeKeyPath(key)}`;
}

function buildStorageUrl(config: ObjectStorageConfig, key: string): URL {
  return new URL(`${config.endpoint}/${encodeURIComponent(config.bucket)}/${encodeKeyPath(key)}`);
}

function buildSignatureHeaders(
  config: ObjectStorageConfig,
  method: "PUT",
  url: URL,
  body: Buffer,
  contentType: string,
  cacheControl?: string
): Headers {
  const headers = new Headers({ "content-type": contentType });
  if (cacheControl) headers.set("cache-control", cacheControl);
  return signRequestHeaders(config, method, url, body, headers);
}

// General SigV4 header signer: any method, any extra headers, body hashed in
// full. Used by the upload paths and by the bucket-to-bucket copy / purge
// helpers below (LIST, COPY and DELETE carry no body).
function signRequestHeaders(
  config: ObjectStorageConfig,
  method: string,
  url: URL,
  body: Buffer,
  extraHeaders: Headers
): Headers {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = toHexSha256(body);
  const host = url.host;
  const canonicalUri = url.pathname;

  const headers = new Headers(extraHeaders);
  headers.set("host", host);
  headers.set("x-amz-content-sha256", payloadHash);
  headers.set("x-amz-date", amzDate);

  const canonicalQueryString = Array.from(url.searchParams.keys())
    .sort((a, b) => a.localeCompare(b))
    .map(
      (name) =>
        `${encodeURIComponent(name)}=${encodeURIComponent(url.searchParams.get(name) ?? "")}`
    )
    .join("&");

  const sortedHeaderEntries = Array.from(headers.entries()).sort(([a], [b]) => a.localeCompare(b));
  const canonicalHeaders = sortedHeaderEntries
    .map(([name, value]) => `${name}:${value.trim()}\n`)
    .join("");
  const signedHeaders = sortedHeaderEntries.map(([name]) => name).join(";");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    toHexSha256(canonicalRequest),
  ].join("\n");

  const signingKey = hmacSha256(
    hmacSha256(
      hmacSha256(hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp), config.region),
      "s3"
    ),
    "aws4_request"
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  headers.set(
    "authorization",
    [
      `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(", ")
  );

  return headers;
}

export function isObjectStorageConfigured(): boolean {
  return getObjectStorageConfig() !== null;
}

// Construct the public URL for an object key without uploading. Returns null
// when object storage isn't configured. Useful for HEAD-checks against a
// content-addressed cache key before deciding to generate fresh content.
export function getPublicObjectUrl(key: string): string | null {
  const config = getObjectStorageConfig();
  if (!config) return null;
  return buildPublicUrl(config, key.replace(/^\/+/, ""));
}

export async function uploadPublicObject(
  input: UploadPublicObjectInput
): Promise<UploadPublicObjectResult | null> {
  const config = getObjectStorageConfig();
  if (!config) {
    return null;
  }

  const normalizedKey = input.key.replace(/^\/+/, "");
  const url = buildStorageUrl(config, normalizedKey);
  const headers = buildSignatureHeaders(
    config,
    "PUT",
    url,
    input.body,
    input.contentType,
    input.cacheControl ?? "public, max-age=31536000, immutable"
  );

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: new Uint8Array(input.body),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `Object storage upload failed (${response.status}) for ${normalizedKey}: ${details.slice(0, 300)}`
    );
  }

  return {
    key: normalizedKey,
    url: buildPublicUrl(config, normalizedKey),
  };
}

type PresignedPutResult = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
};

// Generate a SigV4 presigned PUT URL the browser can use to upload a file
// directly to R2, bypassing the Vercel 4.5 MB request body limit. Returns
// null when object storage isn't configured.
//
// The client must PUT with no extra headers beyond what the URL implies; we
// only sign `host` so the upload is robust to browser-injected headers. The
// payload itself is treated as UNSIGNED-PAYLOAD so the client doesn't need
// to hash the bytes before uploading.
export function getPresignedPutUrl(input: {
  key: string;
  expiresInSeconds?: number;
}): PresignedPutResult | null {
  const config = getObjectStorageConfig();
  if (!config) return null;

  const expires = Math.min(Math.max(input.expiresInSeconds ?? 600, 60), 3600);
  const normalizedKey = input.key.replace(/^\/+/, "");

  return {
    uploadUrl: buildPresignedUrl(config, "PUT", normalizedKey, expires),
    publicUrl: buildPublicUrl(config, normalizedKey),
    key: normalizedKey,
  };
}

// Shared SigV4 query signer for presigned URLs. The payload is always
// UNSIGNED-PAYLOAD and `host` is the only signed header, so the caller (a
// browser uploading, or an audio player fetching) needs no extra headers.
function buildPresignedUrl(
  config: ObjectStorageConfig,
  method: "GET" | "PUT",
  normalizedKey: string,
  expires: number
): string {
  const url = buildStorageUrl(config, normalizedKey);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const signedHeaders = "host";

  const queryEntries: Array<[string, string]> = (
    [
      ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
      ["X-Amz-Credential", `${config.accessKeyId}/${credentialScope}`],
      ["X-Amz-Date", amzDate],
      ["X-Amz-Expires", String(expires)],
      ["X-Amz-SignedHeaders", signedHeaders],
    ] as Array<[string, string]>
  ).sort(([a], [b]) => a.localeCompare(b));

  const canonicalQueryString = queryEntries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalHeaders = `host:${url.host}\n`;

  const canonicalRequest = [
    method,
    url.pathname,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    toHexSha256(canonicalRequest),
  ].join("\n");

  const signingKey = hmacSha256(
    hmacSha256(
      hmacSha256(hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp), config.region),
      "s3"
    ),
    "aws4_request"
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return `${url.origin}${url.pathname}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

// Generate a SigV4 presigned GET URL for an object in the PRIVATE bucket.
// This is what turns a permanent public mp3 link into a short-lived one: the
// bytes stop being reachable without a signature, and the signature dies with
// the expiry. Returns null when object storage isn't configured.
//
// Default life: 24 h. Long enough for a reading session (including a mobile
// snapshot cached while offline), useless as something to share or scrape.
export function getPresignedGetUrl(input: {
  key: string;
  expiresInSeconds?: number;
}): string | null {
  const config = getPrivateObjectStorageConfig();
  if (!config) return null;

  // SigV4 refuses anything over 7 days; the floor keeps a caller from
  // handing out a URL that dies before the player reaches it.
  const expires = Math.min(Math.max(input.expiresInSeconds ?? 86400, 60), 604800);
  const normalizedKey = input.key.replace(/^\/+/, "");

  return buildPresignedUrl(config, "GET", normalizedKey, expires);
}

// Upload an audio object. With MEDIA_SIGNED_AUDIO on it writes to the private
// bucket; with the flag off it behaves exactly like uploadPublicObject. Either
// way it returns the canonical PUBLIC url, which is the identifier we store in
// the database and never migrate: the signer derives the key back from it at
// delivery time.
//
// Images and covers keep using uploadPublicObject: they are public on purpose.
export async function uploadAudioObject(
  input: UploadPublicObjectInput
): Promise<UploadPublicObjectResult | null> {
  if (!isSignedAudioEnabled()) {
    return uploadPublicObject(input);
  }

  const config = getPrivateObjectStorageConfig();
  if (!config) return null;

  const normalizedKey = input.key.replace(/^\/+/, "");
  const url = buildStorageUrl(config, normalizedKey);
  const headers = buildSignatureHeaders(
    config,
    "PUT",
    url,
    input.body,
    input.contentType,
    // Private objects are served through a presigned URL that already expires;
    // a year of immutable caching downstream is still correct for the bytes.
    input.cacheControl ?? "private, max-age=31536000, immutable"
  );

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: new Uint8Array(input.body),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `Private object storage upload failed (${response.status}) for ${normalizedKey}: ${details.slice(0, 300)}`
    );
  }

  return {
    key: normalizedKey,
    // Public url on purpose: it is the canonical identifier, not a promise
    // that the bytes are reachable without a signature.
    url: buildPublicUrl(config, normalizedKey),
  };
}

// Read here and not from mediaSigning to avoid a cycle: mediaSigning imports
// this module.
function isSignedAudioEnabled(): boolean {
  const value = readEnv("MEDIA_SIGNED_AUDIO").toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export { isSignedAudioEnabled };

// ---------------------------------------------------------------------------
// Bucket-to-bucket maintenance (listing, copy, delete). Used by the one-off
// scripts that move existing audio into the private bucket and, later, purge
// it from the public one. Nothing in the request path calls these.
// ---------------------------------------------------------------------------

const EMPTY_BODY = Buffer.alloc(0);

export type StorageListPage = {
  keys: string[];
  nextToken: string | null;
};

async function listObjects(
  config: ObjectStorageConfig,
  prefix: string,
  continuationToken: string | null
): Promise<StorageListPage> {
  const url = new URL(`${config.endpoint}/${encodeURIComponent(config.bucket)}`);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("prefix", prefix.replace(/^\/+/, ""));
  url.searchParams.set("max-keys", "1000");
  if (continuationToken) {
    url.searchParams.set("continuation-token", continuationToken);
  }

  const headers = signRequestHeaders(config, "GET", url, EMPTY_BODY, new Headers());
  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`List failed (${response.status}) for ${prefix}: ${details.slice(0, 300)}`);
  }

  const xml = await response.text();
  const keys = Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g)).map((m) =>
    decodeXmlEntities(m[1])
  );
  const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml);
  const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);

  return {
    keys,
    nextToken: truncated && tokenMatch ? decodeXmlEntities(tokenMatch[1]) : null,
  };
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** One page of keys under a prefix in the PUBLIC bucket. */
export function listPublicObjects(
  prefix: string,
  continuationToken: string | null = null
): Promise<StorageListPage> {
  const config = getObjectStorageConfig();
  if (!config) throw new Error("Object storage is not configured");
  return listObjects(config, prefix, continuationToken);
}

/** One page of keys under a prefix in the PRIVATE bucket. */
export function listPrivateObjects(
  prefix: string,
  continuationToken: string | null = null
): Promise<StorageListPage> {
  const config = getPrivateObjectStorageConfig();
  if (!config) throw new Error("Object storage is not configured");
  return listObjects(config, prefix, continuationToken);
}

/**
 * Server-side copy from the public bucket to the private one. The bytes never
 * travel through this process: S3 CopyObject moves them inside the account.
 */
export async function copyObjectToPrivateBucket(key: string): Promise<void> {
  const publicConfig = getObjectStorageConfig();
  const privateConfig = getPrivateObjectStorageConfig();
  if (!publicConfig || !privateConfig) {
    throw new Error("Object storage is not configured");
  }
  if (publicConfig.bucket === privateConfig.bucket) {
    throw new Error("MEDIA_PRIVATE_BUCKET is missing: source and destination are the same bucket");
  }

  const normalizedKey = key.replace(/^\/+/, "");
  const url = buildStorageUrl(privateConfig, normalizedKey);
  const source = `/${publicConfig.bucket}/${encodeKeyPath(normalizedKey)}`;
  const headers = signRequestHeaders(
    privateConfig,
    "PUT",
    url,
    EMPTY_BODY,
    new Headers({ "x-amz-copy-source": source })
  );

  const response = await fetch(url, { method: "PUT", headers });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Copy failed (${response.status}) for ${normalizedKey}: ${details.slice(0, 300)}`);
  }

  // R2 and S3 can answer 200 with an error document inside the body.
  const body = await response.text().catch(() => "");
  if (body.includes("<Error>")) {
    throw new Error(`Copy failed (200 with error body) for ${normalizedKey}: ${body.slice(0, 300)}`);
  }
}

/** Delete one object from the PUBLIC bucket. Irreversible. */
export async function deletePublicObject(key: string): Promise<void> {
  const config = getObjectStorageConfig();
  if (!config) throw new Error("Object storage is not configured");

  const normalizedKey = key.replace(/^\/+/, "");
  const url = buildStorageUrl(config, normalizedKey);
  const headers = signRequestHeaders(config, "DELETE", url, EMPTY_BODY, new Headers());

  const response = await fetch(url, { method: "DELETE", headers });
  if (!response.ok && response.status !== 404) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `Delete failed (${response.status}) for ${normalizedKey}: ${details.slice(0, 300)}`
    );
  }
}

export async function copyRemoteAssetToObjectStorage(args: {
  sourceUrl: string;
  key: string;
  contentType?: string;
}): Promise<UploadPublicObjectResult | null> {
  const response = await fetch(args.sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch remote asset ${args.sourceUrl}: ${response.status}`);
  }

  const body = Buffer.from(await response.arrayBuffer());
  const contentType =
    args.contentType?.trim() || response.headers.get("content-type") || "application/octet-stream";

  return uploadPublicObject({
    key: args.key,
    body,
    contentType,
  });
}
