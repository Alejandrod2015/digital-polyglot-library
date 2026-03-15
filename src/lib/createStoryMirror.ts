import type { SanityClient } from "@sanity/client";
import { writeClient } from "@/sanity/lib/client";

type UserStoryMirrorInput = {
  id: string;
  userId: string;
  title: string;
  slug: string;
  text: string;
  vocab: unknown;
  language: string;
  variant: string | null;
  region: string | null;
  level: string;
  cefrLevel: string | null;
  focus: string | null;
  topic: string;
  public: boolean;
  coverUrl?: string | null;
  coverFilename?: string | null;
  audioUrl?: string | null;
  audioFilename?: string | null;
};

type RegionField =
  | "region_es"
  | "region_en"
  | "region_de"
  | "region_fr"
  | "region_it"
  | "region_pt";

const MIRROR_DOC_PREFIX = "create-story.";

function getMirrorDocId(storyId: string) {
  return `${MIRROR_DOC_PREFIX}${storyId}`;
}

function normalizeLevel(level: string) {
  return level.trim().toLowerCase();
}

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getLanguageSpecificRegionField(language: string): RegionField | null {
  switch (language.trim().toLowerCase()) {
    case "spanish":
      return "region_es";
    case "english":
      return "region_en";
    case "german":
      return "region_de";
    case "french":
      return "region_fr";
    case "italian":
      return "region_it";
    case "portuguese":
      return "region_pt";
    default:
      return null;
  }
}

async function uploadRemoteAsset(
  client: SanityClient,
  kind: "image" | "file",
  url: string,
  filename: string
) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${kind} asset from ${url}: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return client.assets.upload(kind, buffer, {
    filename,
  });
}

export async function syncCreateStoryMirror(
  story: UserStoryMirrorInput,
  client: SanityClient = writeClient
) {
  const docId = getMirrorDocId(story.id);
  const existing = await client.fetch<{
    _id: string;
    slug?: { current?: string };
    cover?: { asset?: { _id?: string } };
    audio?: { asset?: { _id?: string } };
  } | null>(
    `*[_id == $id][0]{
      _id,
      slug,
      cover{asset->{_id}},
      audio{asset->{_id}}
    }`,
    { id: docId }
  );

  const language = story.language.trim().toLowerCase();
  const regionField = getLanguageSpecificRegionField(language);
  const regionValue = normalizeOptional(story.region);
  const vocabRaw = JSON.stringify(story.vocab ?? [], null, 2);
  const canonicalSlug = existing?.slug?.current?.trim() || story.slug;
  const unsetFields = [
    "variant",
    "cefrLevel",
    "focus",
    "region_es",
    "region_en",
    "region_de",
    "region_fr",
    "region_it",
    "region_pt",
  ];

  const basePatch: Record<string, unknown> = {
    title: story.title,
    slug: { _type: "slug", current: canonicalSlug },
    text: story.text,
    vocabRaw,
    language,
    level: normalizeLevel(story.level),
    topic: story.topic,
    published: story.public,
    sourceType: "create",
    createStoryId: story.id,
    createStoryUserId: story.userId,
  };

  const variant = normalizeOptional(story.variant);
  if (variant) {
    basePatch.variant = variant;
  }

  const cefrLevel = normalizeOptional(story.cefrLevel)?.toLowerCase();
  if (cefrLevel) {
    basePatch.cefrLevel = cefrLevel;
  }

  const focus = normalizeOptional(story.focus)?.toLowerCase();
  if (focus) {
    basePatch.focus = focus;
  }

  if (regionField && regionValue) {
    basePatch[regionField] = regionValue;
  }

  const tx = writeClient.transaction();
  tx.createIfNotExists({
    _id: docId,
    _type: "standaloneStory",
    sourceType: "create",
    createStoryId: story.id,
    createStoryUserId: story.userId,
    title: story.title,
  });

  tx.patch(docId, {
    set: basePatch,
    unset: unsetFields,
  });

  if (story.coverUrl && story.coverFilename && !existing?.cover?.asset?._id) {
    try {
      const coverAsset = await uploadRemoteAsset(client, "image", story.coverUrl, story.coverFilename);
      tx.patch(docId, (patch) =>
        patch.set({
          cover: {
            _type: "image",
            asset: {
              _type: "reference",
              _ref: coverAsset._id,
            },
          },
        })
      );
    } catch (error) {
      console.warn("[syncCreateStoryMirror] Failed to mirror cover asset:", error);
    }
  }

  if (story.audioUrl && story.audioFilename && !existing?.audio?.asset?._id) {
    try {
      const audioAsset = await uploadRemoteAsset(client, "file", story.audioUrl, story.audioFilename);
      tx.patch(docId, (patch) =>
        patch.set({
          audio: {
            _type: "file",
            asset: {
              _type: "reference",
              _ref: audioAsset._id,
            },
          },
        })
      );
    } catch (error) {
      console.warn("[syncCreateStoryMirror] Failed to mirror audio asset:", error);
    }
  }

  await tx.commit();
}
