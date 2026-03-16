import "dotenv/config";

import { readdir, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { isObjectStorageConfigured, uploadPublicObject } from "../src/lib/objectStorage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function contentTypeForFile(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

async function uploadDirectory(localDir: string, remotePrefix: string) {
  const entries = await readdir(localDir, { withFileTypes: true });

  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    const remoteKey = `${remotePrefix}/${entry.name}`;

    if (entry.isDirectory()) {
      await uploadDirectory(localPath, remoteKey);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const body = await readFile(localPath);
    const contentType = contentTypeForFile(entry.name);
    const uploaded = await uploadPublicObject({
      key: remoteKey,
      body,
      contentType,
    });

    console.log("[upload-catalog-media]", localPath, "->", uploaded?.url ?? "(skipped)");
  }
}

async function main() {
  if (!isObjectStorageConfigured()) {
    throw new Error("Missing MEDIA_STORAGE_* env vars. Object storage is not configured.");
  }

  await uploadDirectory(
    path.join(projectRoot, "public", "media", "catalog", "images"),
    "media/catalog/images"
  );
  await uploadDirectory(
    path.join(projectRoot, "public", "media", "catalog", "audio"),
    "media/catalog/audio"
  );

  console.log("[upload-catalog-media] completed.");
}

main().catch((error) => {
  console.error("[upload-catalog-media] failed:", error);
  process.exit(1);
});
