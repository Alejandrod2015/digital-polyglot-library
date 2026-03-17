import "dotenv/config";

import { writeClient } from "@/sanity/lib/client";
import { copyRemoteAssetToObjectStorage, isObjectStorageConfigured } from "@/lib/objectStorage";

type StandaloneStoryDoc = {
  _id: string;
  slug: string | null;
  sourceType: string | null;
  coverUrl: string | null;
  audioUrl: string | null;
  externalCoverUrl: string | null;
  externalAudioUrl: string | null;
};

function fileExtensionFromUrl(value: string, fallback: string): string {
  try {
    const pathname = new URL(value).pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    return match ? match[1].toLowerCase() : fallback;
  } catch {
    return fallback;
  }
}

function versionTokenFromUrl(value: string): string {
  try {
    const pathname = new URL(value).pathname;
    const filename = pathname.split("/").pop() ?? "";
    const withoutExt = filename.replace(/\.[a-z0-9]+$/i, "");
    const token = withoutExt.trim().toLowerCase();
    return token || "current";
  } catch {
    return "current";
  }
}

function buildObjectKey(doc: StandaloneStoryDoc, kind: "cover" | "audio", sourceUrl: string): string {
  const ext = kind === "cover"
    ? fileExtensionFromUrl(sourceUrl, "png")
    : fileExtensionFromUrl(sourceUrl, "mp3");
  const slug = (doc.slug || doc._id).replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
  const version = versionTokenFromUrl(sourceUrl);
  return `media/standalone/${slug}/${kind}-${version}.${ext}`;
}

async function main() {
  if (!isObjectStorageConfigured()) {
    throw new Error("Missing MEDIA_STORAGE_* env vars. Object storage is not configured.");
  }

  const docs = await writeClient.fetch<StandaloneStoryDoc[]>(`
    *[_type == "standaloneStory"]{
      _id,
      "slug": slug.current,
      sourceType,
      "coverUrl": cover.asset->url,
      "audioUrl": audio.asset->url,
      "externalCoverUrl": coverUrl,
      "externalAudioUrl": audioUrl
    }
  `);

  let updatedCount = 0;

  for (const doc of docs) {
    const patch: Record<string, string> = {};

    if (!doc.externalCoverUrl && doc.coverUrl) {
      const uploaded = await copyRemoteAssetToObjectStorage({
        sourceUrl: doc.coverUrl,
        key: buildObjectKey(doc, "cover", doc.coverUrl),
      });
      if (uploaded?.url) {
        patch.coverUrl = uploaded.url;
      }
    }

    if (!doc.externalAudioUrl && doc.audioUrl) {
      const uploaded = await copyRemoteAssetToObjectStorage({
        sourceUrl: doc.audioUrl,
        key: buildObjectKey(doc, "audio", doc.audioUrl),
      });
      if (uploaded?.url) {
        patch.audioUrl = uploaded.url;
      }
    }

    if (Object.keys(patch).length === 0) {
      continue;
    }

    await writeClient.patch(doc._id).set(patch).commit({ autoGenerateArrayKeys: true });
    updatedCount += 1;
    console.log(`[backfill-standalone-media] updated ${doc._id}`, patch);
  }

  console.log(`[backfill-standalone-media] completed. Updated ${updatedCount} documents.`);
}

main().catch((error) => {
  console.error("[backfill-standalone-media] failed:", error);
  process.exit(1);
});
