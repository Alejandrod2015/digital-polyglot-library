import "dotenv/config";

import slugify from "slugify";

import { prisma } from "@/lib/prisma";
import { copyRemoteAssetToObjectStorage, isObjectStorageConfigured } from "@/lib/objectStorage";
import { writeClient } from "@/sanity/lib/client";

type CreateMirrorDoc = {
  _id: string;
  createStoryId: string | null;
  slug: string | null;
  title: string | null;
  assetCoverUrl: string | null;
  externalCoverUrl: string | null;
  assetAudioUrl: string | null;
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

function canonicalSlug(doc: Pick<CreateMirrorDoc, "slug" | "title" | "_id">): string {
  const preferred = (doc.slug ?? "").trim();
  if (preferred) return preferred;

  const clean = slugify(doc.title ?? "", { lower: true, strict: true, locale: "es" }).trim();
  return clean || doc._id.replace(/^drafts\./, "");
}

function buildObjectKey(
  doc: Pick<CreateMirrorDoc, "slug" | "title" | "_id">,
  kind: "cover" | "audio",
  sourceUrl: string
): string {
  const ext = kind === "cover"
    ? fileExtensionFromUrl(sourceUrl, "png")
    : fileExtensionFromUrl(sourceUrl, "mp3");
  const version = versionTokenFromUrl(sourceUrl);
  return `media/polyglot/${canonicalSlug(doc)}/${kind}-${version}.${ext}`;
}

async function main() {
  if (!isObjectStorageConfigured()) {
    throw new Error("Missing MEDIA_STORAGE_* env vars. Object storage is not configured.");
  }

  const docs = await writeClient.fetch<CreateMirrorDoc[]>(`
    *[_type == "standaloneStory" && sourceType == "create" && published == true]{
      _id,
      createStoryId,
      "slug": slug.current,
      title,
      "assetCoverUrl": cover.asset->url,
      "externalCoverUrl": coverUrl,
      "assetAudioUrl": audio.asset->url,
      "externalAudioUrl": audioUrl
    }
  `);

  let updatedDocs = 0;
  let updatedStories = 0;
  let updatedLibraryRows = 0;

  for (const doc of docs) {
    const patch: Record<string, string> = {};

    if (doc.assetCoverUrl) {
      const uploaded = await copyRemoteAssetToObjectStorage({
        sourceUrl: doc.assetCoverUrl,
        key: buildObjectKey(doc, "cover", doc.assetCoverUrl),
      });
      if (uploaded?.url && uploaded.url !== doc.externalCoverUrl) {
        patch.coverUrl = uploaded.url;
      }
    }

    if (doc.assetAudioUrl) {
      const uploaded = await copyRemoteAssetToObjectStorage({
        sourceUrl: doc.assetAudioUrl,
        key: buildObjectKey(doc, "audio", doc.assetAudioUrl),
      });
      if (uploaded?.url && uploaded.url !== doc.externalAudioUrl) {
        patch.audioUrl = uploaded.url;
      }
    }

    if (Object.keys(patch).length === 0) {
      continue;
    }

    await writeClient.patch(doc._id).set(patch).commit({ autoGenerateArrayKeys: true });
    updatedDocs += 1;

    if (doc.createStoryId) {
      const storyPatch: { coverUrl?: string; audioUrl?: string } = {};
      if (patch.coverUrl) storyPatch.coverUrl = patch.coverUrl;
      if (patch.audioUrl) storyPatch.audioUrl = patch.audioUrl;

      if (Object.keys(storyPatch).length > 0) {
        await prisma.userStory.update({
          where: { id: doc.createStoryId },
          data: storyPatch,
        });
        updatedStories += 1;

        if (patch.coverUrl) {
          const result = await prisma.libraryStory.updateMany({
            where: { storyId: doc.createStoryId },
            data: { coverUrl: patch.coverUrl },
          });
          updatedLibraryRows += result.count;
        }
      }
    }

    console.log(`[reconcile-create-story-media] updated ${doc._id}`, patch);
  }

  console.log(
    `[reconcile-create-story-media] completed. Updated ${updatedDocs} Sanity docs, ${updatedStories} Prisma stories, and ${updatedLibraryRows} library rows.`
  );
}

main()
  .catch((error) => {
    console.error("[reconcile-create-story-media] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
