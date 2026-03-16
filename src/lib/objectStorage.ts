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
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = toHexSha256(body);
  const host = url.host;
  const canonicalUri = url.pathname;

  const headers = new Headers({
    "content-type": contentType,
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  });

  if (cacheControl) {
    headers.set("cache-control", cacheControl);
  }

  const sortedHeaderEntries = Array.from(headers.entries()).sort(([a], [b]) => a.localeCompare(b));
  const canonicalHeaders = sortedHeaderEntries
    .map(([name, value]) => `${name}:${value.trim()}\n`)
    .join("");
  const signedHeaders = sortedHeaderEntries.map(([name]) => name).join(";");

  const canonicalRequest = [
    method,
    canonicalUri,
    "",
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
