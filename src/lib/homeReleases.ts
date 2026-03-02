// /src/lib/homeReleases.ts
import { books } from "@/data/books";
import { getPublicUserStories } from "@/lib/userStories";

export type LatestBook = {
  slug: string;
  title: string;
  language?: string;
  level?: string;
  cover?: string;
  description?: string;
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

function isLatestPolyglotStory(x: unknown): x is LatestPolyglotStory {
  if (!isRecord(x)) return false;
  return typeof x.slug === "string" && typeof x.title === "string";
}

export async function getLatestHomeReleases({ limit }: Options): Promise<{
  latestBooks: LatestBook[];
  latestStories: LatestStory[];
  latestPolyglotStories: LatestPolyglotStory[];
}> {
  const allBooks = Object.values(books);

  const latestBooks: LatestBook[] = allBooks
    .slice()
    .reverse()
    .slice(0, limit)
    .map((book) => ({
      slug: book.slug,
      title: book.title,
      language: book.language,
      level: book.level,
      cover: book.cover ?? "/covers/default.jpg",
      description: book.description,
    }));

  const latestStories: LatestStory[] = allBooks
    .slice()
    .reverse()
    .flatMap((book) =>
      (book.stories ?? []).slice().reverse().map((story) => ({
        bookSlug: book.slug,
        bookTitle: book.title,
        storySlug: story.slug,
        storyTitle: story.title,
        language: story.language ?? book.language,
        level: story.level ?? book.level,
        coverUrl: story.cover ?? book.cover ?? "/covers/default.jpg",
      }))
    )
    .slice(0, limit);

  const polyglotRaw = await getPublicUserStories({ limit });

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
