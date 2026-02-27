// /src/lib/homeReleases.ts
import { sanityClient } from "@/sanity";
import { getPublicUserStories } from "@/lib/userStories";

export type LatestBook = {
  slug: string;
  title: string;
  language?: string;
  level?: string;
  cover?: string;
};

export type LatestStory = {
  bookSlug: string;
  bookTitle: string;
  storySlug: string;
  storyTitle: string;
  language?: string;
  level?: string;
  coverUrl: string;
};

export type LatestPolyglotStory = {
  slug: string;
  title: string;
  language?: string;
  level?: string;
  text?: string;
  coverUrl?: string;
};

type Options = { limit: number };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isLatestBook(v: unknown): v is LatestBook {
  if (!isRecord(v)) return false;
  return typeof v.slug === "string" && typeof v.title === "string";
}

function isLatestStory(v: unknown): v is LatestStory {
  if (!isRecord(v)) return false;
  return (
    typeof v.bookSlug === "string" &&
    typeof v.bookTitle === "string" &&
    typeof v.storySlug === "string" &&
    typeof v.storyTitle === "string" &&
    typeof v.coverUrl === "string"
  );
}

export async function getLatestHomeReleases({ limit }: Options): Promise<{
  latestBooks: LatestBook[];
  latestStories: LatestStory[];
  latestPolyglotStories: LatestPolyglotStory[];
}> {
  const booksQuery = `*[_type == "book" && published == true] | order(_createdAt desc)[0...$limit]{
    "slug": slug.current,
    title,
    language,
    level,
    "cover": coalesce(cover.asset->url, "/covers/default.jpg")
  }`;

  const storiesQuery = `*[_type == "story" && published == true] | order(_createdAt desc)[0...$limit]{
    "bookSlug": book->slug.current,
    "bookTitle": coalesce(book->title, book->slug.current),
    "storySlug": slug.current,
    "storyTitle": coalesce(title, "Untitled story"),
    language,
    level,
    "coverUrl": coalesce(cover.asset->url, book->cover.asset->url, "/covers/default.jpg")
  }`;

  const [booksRaw, storiesRaw, polyglotRaw] = await Promise.all([
    sanityClient.fetch<unknown>(booksQuery, { limit }),
    sanityClient.fetch<unknown>(storiesQuery, { limit }),
    getPublicUserStories(),
  ]);

  const latestBooks = Array.isArray(booksRaw) ? booksRaw.filter(isLatestBook) : [];
  const latestStories = Array.isArray(storiesRaw) ? storiesRaw.filter(isLatestStory) : [];

function isLatestPolyglotStory(x: unknown): x is LatestPolyglotStory {
  if (!isRecord(x)) return false;
  return typeof x.slug === "string" && typeof x.title === "string";
}

const latestPolyglotStories: LatestPolyglotStory[] = Array.isArray(polyglotRaw)
  ? polyglotRaw
      .map((s: unknown) => {
        if (!isRecord(s)) return null;

        const slug = typeof s.slug === "string" ? s.slug : null;
        if (!slug) return null;

        const title = typeof s.title === "string" ? s.title : "";
        const language = typeof s.language === "string" ? s.language : undefined;
        const level = typeof s.level === "string" ? s.level : undefined;
        const text = typeof s.text === "string" ? s.text : undefined;

        const coverUrl =
          typeof s.coverUrl === "string" && s.coverUrl.trim() !== ""
            ? s.coverUrl
            : "/covers/default.jpg";

        const out: LatestPolyglotStory = { slug, title, language, level, text, coverUrl };
        return out;
      })
      .filter(isLatestPolyglotStory)
      .slice(0, limit)
  : [];

  return { latestBooks, latestStories, latestPolyglotStories };
}