// /src/lib/homeReleases.ts
import { books } from "@/data/books";
import { getPublishedStandaloneStories } from "@/lib/standaloneStories";
import { getPublicUserStories } from "@/lib/userStories";
import { resolvePublicMediaUrl } from "@/lib/publicMedia";

export type LatestBook = {
  slug: string;
  title: string;
  language?: string;
  region?: string;
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
  region?: string;
  level?: string;
  coverUrl: string;
  audioUrl?: string;
  topic?: string;
};

export type LatestPolyglotStory = {
  slug: string;
  title: string;
  language?: string;
  region?: string;
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

function toTimestamp(value: unknown): number {
  if (typeof value !== "string" || !value) return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

function getEntityTimestamp(entity: unknown): number {
  if (!isRecord(entity)) return 0;
  return Math.max(toTimestamp(entity.updatedAt), toTimestamp(entity.createdAt));
}

export async function getLatestHomeReleases({ limit }: Options): Promise<{
  latestBooks: LatestBook[];
  latestStories: LatestStory[];
  latestPolyglotStories: LatestPolyglotStory[];
}> {
  const allBooks = Object.values(books);

  const latestBooks: LatestBook[] = allBooks
    .slice()
    .sort((a, b) => {
      const aTs = getEntityTimestamp(a);
      const bTs = getEntityTimestamp(b);
      return bTs - aTs;
    })
    .slice(0, limit)
    .map((book) => ({
      slug: book.slug,
      title: book.title,
      language: book.language,
      region: book.region,
      level: book.level,
      cover: book.cover ?? "/covers/default.jpg",
      description: book.description,
    }));

  const bookStories: Array<LatestStory & { _ts: number }> = allBooks
    .slice()
    .flatMap((book) => {
      const bookTs = getEntityTimestamp(book);
      return (book.stories ?? []).map((story) => {
        const storyCoverRaw =
          (typeof story.cover === "string" && story.cover.trim() !== ""
            ? story.cover
            : undefined) ??
          (typeof (story as { coverUrl?: unknown }).coverUrl === "string" &&
          ((story as { coverUrl?: string }).coverUrl ?? "").trim() !== ""
            ? (story as { coverUrl?: string }).coverUrl
            : undefined);
        const resolvedStoryCover = storyCoverRaw
          ? resolvePublicMediaUrl(storyCoverRaw) ?? storyCoverRaw
          : undefined;
        return ({
        bookSlug: book.slug,
        bookTitle: book.title,
        storySlug: story.slug,
        storyTitle: story.title,
        language: story.language ?? book.language,
        region: story.region ?? book.region,
        level: story.level ?? book.level,
        coverUrl: resolvedStoryCover ?? book.cover ?? "/covers/default.jpg",
        audioUrl:
          typeof story.audio === "string" && story.audio.trim() !== ""
            ? story.audio
            : undefined,
        topic: story.topic ?? book.topic,
        _ts: Math.max(
          getEntityTimestamp(story),
          bookTs
        ),
      });
      });
    })
    .sort((a, b) => b._ts - a._ts);

  const standaloneStories = await getPublishedStandaloneStories();

  const latestStories: LatestStory[] = [
    ...bookStories,
    ...standaloneStories.map((story) => ({
      bookSlug: "standalone",
      bookTitle: "Individual Stories",
      storySlug: story.slug,
      storyTitle: story.title,
      language: story.language ?? undefined,
      region: story.region ?? undefined,
      level: story.level ?? undefined,
      coverUrl: story.coverUrl || "/covers/default.jpg",
      audioUrl: story.audioUrl ?? undefined,
      topic: story.topic ?? undefined,
      _ts: toTimestamp(story.createdAt),
    })),
  ]
    .sort((a, b) => b._ts - a._ts)
    .slice(0, limit)
    .map(({ _ts, ...item }) => item);

  const polyglotRaw = await getPublicUserStories({ limit });

  const latestPolyglotStories: LatestPolyglotStory[] = Array.isArray(polyglotRaw)
    ? polyglotRaw
        .map((s: unknown) => {
          if (!isRecord(s)) return null;

          const slug = typeof s.slug === "string" ? s.slug : null;
          if (!slug) return null;

          const title = typeof s.title === "string" ? s.title : "";
          const language = typeof s.language === "string" ? s.language : undefined;
          const region = typeof s.region === "string" ? s.region : undefined;
          const level = typeof s.level === "string" ? s.level : undefined;
          const text = typeof s.text === "string" ? s.text : undefined;

          const coverUrl =
            typeof s.coverUrl === "string" && s.coverUrl.trim() !== ""
              ? s.coverUrl
              : "/covers/default.jpg";

          const out: LatestPolyglotStory = { slug, title, language, region, level, text, coverUrl };
          return out;
        })
        .filter(isLatestPolyglotStory)
        .slice(0, limit)
    : [];

  return { latestBooks, latestStories, latestPolyglotStories };
}
