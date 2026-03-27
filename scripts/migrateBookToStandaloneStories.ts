import { createClient } from "@sanity/client";
import dotenv from "dotenv";
import { colloquialgermanstories } from "../src/data/books/colloquial-german-stories";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

type StoryDoc = {
  _id: string;
  _type: "story";
  title: string | null;
  slug: string | null;
  synopsis: string | null;
  text: string | null;
  language: string | null;
  variant: string | null;
  level: string | null;
  cefrLevel: string | null;
  topic: string | null;
  formality: string | null;
  vocabRaw: string | null;
  published: boolean | null;
  cover: {
    _type: "image";
    asset?: { _type: "reference"; _ref: string };
  } | null;
  coverUrl: string | null;
  audio: {
    _type: "file";
    asset?: { _type: "reference"; _ref: string };
  } | null;
  audioUrl: string | null;
  region_es: string | null;
  region_en: string | null;
  region_de: string | null;
  region_fr: string | null;
  region_it: string | null;
  region_pt: string | null;
};

type BookDoc = {
  _id: string;
  _type: "book";
  title: string | null;
  slug: string | null;
  description: string | null;
  language: string | null;
  variant: string | null;
  region: string | null;
  level: string | null;
  cefrLevel: string | null;
  topic: string | null;
  theme: string[] | null;
  published: boolean | null;
};

type StandaloneStoryDoc = {
  _id: string;
  slug: string | null;
};

type LocalStory = {
  id: string;
  slug: string;
  title: string;
  text: string;
  audio?: string;
  cover?: string;
  coverUrl?: string;
  topic?: string;
  vocab?: unknown[];
};

const BOOK_SLUG = "colloquial-german-stories";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_WRITE_TOKEN;

if (!projectId || !dataset || !token) {
  console.error("❌ Missing Sanity env vars.");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: "2025-10-05",
  useCdn: false,
  perspective: "raw",
});

function getStoryRegionField(language: string | null | undefined): string | null {
  switch ((language ?? "").toLowerCase()) {
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

function getStoryRegionValue(story: StoryDoc, book: BookDoc): string | null {
  return (
    story.region_es ??
    story.region_en ??
    story.region_de ??
    story.region_fr ??
    story.region_it ??
    story.region_pt ??
    book.region ??
    null
  );
}

async function main() {
  const book = await client.fetch<BookDoc | null>(
    `
      *[
        _type == "book" &&
        slug.current == $slug
      ][0]{
        _id,
        _type,
        title,
        "slug": slug.current,
        description,
        language,
        variant,
        region,
        level,
        cefrLevel,
        topic,
        theme,
        published
      }
    `,
    { slug: BOOK_SLUG }
  );

  if (!book) {
    throw new Error(`Book not found for slug "${BOOK_SLUG}"`);
  }

  const stories = await client.fetch<StoryDoc[]>(
    `
      *[
        _type == "story" &&
        book._ref == $bookId
      ] | order(_createdAt asc) {
        _id,
        _type,
        title,
        "slug": slug.current,
        synopsis,
        text,
        language,
        variant,
        level,
        cefrLevel,
        topic,
        formality,
        vocabRaw,
        published,
        cover,
        coverUrl,
        audio,
        audioUrl,
        region_es,
        region_en,
        region_de,
        region_fr,
        region_it,
        region_pt
      }
    `,
    { bookId: book._id }
  );

  const fallbackStories: StoryDoc[] =
    stories.length > 0
      ? []
      : (colloquialgermanstories.stories ?? []).map((story: LocalStory) => {
          const regionField = getStoryRegionField(colloquialgermanstories.language ?? null);
          const regionValue = colloquialgermanstories.region ?? null;

          return {
            _id: `local.${story.slug}`,
            _type: "story",
            title: story.title ?? null,
            slug: story.slug ?? null,
            synopsis: null,
            text: story.text ?? null,
            language: colloquialgermanstories.language ?? null,
            variant: colloquialgermanstories.variant ?? null,
            level: colloquialgermanstories.level ?? null,
            cefrLevel: colloquialgermanstories.cefrLevel ?? null,
            topic: story.topic ?? colloquialgermanstories.topic ?? null,
            formality: colloquialgermanstories.formality ?? null,
            vocabRaw: Array.isArray(story.vocab) ? JSON.stringify(story.vocab, null, 2) : null,
            published: true,
            cover: null,
            coverUrl: story.coverUrl ?? story.cover ?? null,
            audio: null,
            audioUrl: story.audio ?? null,
            region_es: regionField === "region_es" ? regionValue : null,
            region_en: regionField === "region_en" ? regionValue : null,
            region_de: regionField === "region_de" ? regionValue : null,
            region_fr: regionField === "region_fr" ? regionValue : null,
            region_it: regionField === "region_it" ? regionValue : null,
            region_pt: regionField === "region_pt" ? regionValue : null,
          };
        });

  const sourceStories = stories.length > 0 ? stories : fallbackStories;

  const storySlugs = sourceStories
    .map((story) => story.slug)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);

  if (storySlugs.length === 0) {
    throw new Error(`No stories found for "${BOOK_SLUG}"`);
  }

  const existingStandaloneStories = await client.fetch<StandaloneStoryDoc[]>(
    `
      *[
        _type == "standaloneStory" &&
        slug.current in $slugs
      ]{
        _id,
        "slug": slug.current
      }
    `,
    { slugs: storySlugs }
  );

  const existingBySlug = new Map(
    existingStandaloneStories
      .filter((doc) => typeof doc.slug === "string" && doc.slug.length > 0)
      .map((doc) => [doc.slug as string, doc._id])
  );

  const tx = client.transaction();

  for (const story of sourceStories) {
    if (!story.slug) {
      console.warn(`⚠️ Skipping story without slug: ${story._id}`);
      continue;
    }

    const standaloneId = existingBySlug.get(story.slug) ?? `standaloneStory.${story.slug}`;
    const language = story.language ?? book.language ?? null;
    const variant = story.variant ?? book.variant ?? null;
    const level = story.level ?? book.level ?? null;
    const cefrLevel = story.cefrLevel ?? book.cefrLevel ?? null;
    const topic = story.topic ?? book.topic ?? null;
    const regionField = getStoryRegionField(language);
    const regionValue = getStoryRegionValue(story, book);

    tx.createIfNotExists({
      _id: standaloneId,
      _type: "standaloneStory",
      sourceType: "sanity",
    });

    const regionPatch =
      regionField && regionValue
        ? { [regionField]: regionValue }
        : {};

    const setPayload: Record<string, unknown> = {
      sourceType: "sanity",
      title: story.title ?? "Untitled story",
      slug: {
        _type: "slug",
        current: story.slug,
      },
      synopsis: story.synopsis ?? "",
      text: story.text ?? "",
      language,
      variant,
      level,
      cefrLevel,
      topic,
      theme: Array.isArray(book.theme) ? book.theme : [],
      vocabRaw: story.vocabRaw ?? "",
      journeyEligible: false,
      published: true,
      ...regionPatch,
    };

    if (story.cover) {
      setPayload.cover = story.cover;
    }
    if (story.coverUrl) {
      setPayload.coverUrl = story.coverUrl;
    }
    if (story.audio) {
      setPayload.audio = story.audio;
    }
    if (story.audioUrl) {
      setPayload.audioUrl = story.audioUrl;
    }

    const regionUnsetFields = [
      "region_es",
      "region_en",
      "region_de",
      "region_fr",
      "region_it",
      "region_pt",
    ].filter((field) => field !== regionField);

    tx.patch(standaloneId, {
      set: setPayload,
      unset: ["journeyTopic", "journeyOrder", ...regionUnsetFields],
    });

    if (!story._id.startsWith("local.")) {
      tx.patch(story._id, {
        set: {
          published: false,
        },
      });
    }
  }

  tx.patch(book._id, {
    set: {
      published: false,
    },
  });

  await tx.commit({ autoGenerateArrayKeys: true });

  console.log(`✅ Migrated ${sourceStories.length} stories from "${book.title ?? BOOK_SLUG}" into standalone stories and unpublished the book.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("❌ migrate-book-to-standalone-stories failed:", message);
  process.exit(1);
});
