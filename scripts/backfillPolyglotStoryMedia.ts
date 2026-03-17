import "dotenv/config";

import slugify from "slugify";

import { prisma } from "@/lib/prisma";
import { copyRemoteAssetToObjectStorage, isObjectStorageConfigured } from "@/lib/objectStorage";

type PolyglotStoryRecord = {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  audioUrl: string | null;
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

function canonicalStorySlug(story: Pick<PolyglotStoryRecord, "title" | "slug">): string {
  const clean = slugify(story.title, { lower: true, strict: true, locale: "es" }).trim();
  return clean || story.slug.trim();
}

function buildObjectKey(
  story: Pick<PolyglotStoryRecord, "title" | "slug">,
  kind: "cover" | "audio",
  sourceUrl: string
): string {
  const ext = kind === "cover"
    ? fileExtensionFromUrl(sourceUrl, "png")
    : fileExtensionFromUrl(sourceUrl, "mp3");
  const version = versionTokenFromUrl(sourceUrl);

  return `media/polyglot/${canonicalStorySlug(story)}/${kind}-${version}.${ext}`;
}

async function main() {
  if (!isObjectStorageConfigured()) {
    throw new Error("Missing MEDIA_STORAGE_* env vars. Object storage is not configured.");
  }

  const stories = await prisma.userStory.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      coverUrl: true,
      audioUrl: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let updatedStories = 0;
  let updatedLibraryRows = 0;

  for (const story of stories satisfies PolyglotStoryRecord[]) {
    const patch: Partial<Pick<PolyglotStoryRecord, "coverUrl" | "audioUrl" | "slug">> = {};
    const targetSlug = canonicalStorySlug(story);

    if (targetSlug && targetSlug !== story.slug) {
      patch.slug = targetSlug;
    }

    if (story.coverUrl && !story.coverUrl.includes(".r2.dev/") && !story.coverUrl.includes("/media/polyglot/")) {
      const uploaded = await copyRemoteAssetToObjectStorage({
        sourceUrl: story.coverUrl,
        key: buildObjectKey(story, "cover", story.coverUrl),
      });

      if (uploaded?.url) {
        patch.coverUrl = uploaded.url;
      }
    }

    if (story.audioUrl && !story.audioUrl.includes(".r2.dev/") && !story.audioUrl.includes("/media/polyglot/")) {
      const uploaded = await copyRemoteAssetToObjectStorage({
        sourceUrl: story.audioUrl,
        key: buildObjectKey(story, "audio", story.audioUrl),
      });

      if (uploaded?.url) {
        patch.audioUrl = uploaded.url;
      }
    }

    if (Object.keys(patch).length === 0) {
      continue;
    }

    await prisma.userStory.update({
      where: { id: story.id },
      data: patch,
    });

    updatedStories += 1;

    if (patch.coverUrl) {
      const result = await prisma.libraryStory.updateMany({
        where: { storyId: story.id },
        data: { coverUrl: patch.coverUrl },
      });
      updatedLibraryRows += result.count;
    }

    console.log(`[backfill-polyglot-media] updated ${story.id}`, patch);
  }

  console.log(
    `[backfill-polyglot-media] completed. Updated ${updatedStories} stories and ${updatedLibraryRows} library rows.`
  );
}

main()
  .catch((error) => {
    console.error("[backfill-polyglot-media] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
