// Pure mapping from My Library rows (/api/library) to the shapes the cards
// render. Kept out of the component so it can be exercised against real
// payloads without a browser (see scripts/_verifyMyLibraryMapping.ts).
//
// THE RULE (2026-07-28): a saved row is NEVER dropped because a lookup
// failed. Metadata resolves catalog (`meta`, attached server-side) → static
// dump → the title/coverUrl saved on the row itself. Before this, rows whose
// bookId was missing from the static dump were silently skipped, so buyers of
// the four titles absent from the dump saw an empty library.

import type { Book } from "@domain/types/books";
import { formatLanguage, formatLevel } from "@domain/displayFormat";
import { getBookCardMeta } from "@domain/bookCardMeta";
import type { LibraryBookMeta, LibraryStoryMeta } from "@/types/libraryMeta";

export const RETURN_QUERY = "returnTo=/my-library&returnLabel=My%20Library&from=my-library";

export type LibraryBookRow = {
  id: string;
  bookId: string;
  title: string;
  coverUrl: string;
  /** Catalog-resolved metadata attached by /api/library. */
  meta?: LibraryBookMeta | null;
};

export type LibraryStoryRow = {
  id: string;
  storyId: string;
  bookId: string;
  title: string;
  coverUrl: string;
  storySlug?: string;
  bookSlug?: string;
  language?: string;
  region?: string;
  level?: string;
  topic?: string;
  audioUrl?: string | null;
  /** Catalog-resolved metadata attached by /api/library. */
  meta?: LibraryStoryMeta | null;
};

export type BookCarouselItem = {
  slug: string;
  title: string;
  language?: string;
  region?: string;
  level?: string;
  cover?: string;
  description?: string;
  statsLine?: string;
  topicsLine?: string;
  bookId: string;
};

export type StoryItem = {
  id: string;
  storyId: string;
  /** Destination resolved while mapping; never empty. */
  href: string;
  title: string;
  bookTitle: string;
  language: string;
  region?: string;
  level: string;
  topic?: string;
  coverUrl?: string;
  audioUrl?: string | null;
};

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** "colloquial-german-stories" → "Colloquial German Stories". */
function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function fromStaticBook(book: Book): LibraryBookMeta {
  const card = getBookCardMeta(book);
  return {
    slug: book.slug,
    title: book.title,
    description: str(book.description),
    cover: str(book.cover),
    language: str(book.language),
    region: str(book.region),
    level: str(book.level),
    published: book.published,
    statsLine: card.statsLine,
    topicsLine: card.topicsLine,
  };
}

export function toBookCarouselItems(
  rows: LibraryBookRow[],
  staticBooks: Book[]
): BookCarouselItem[] {
  return rows.map((item) => {
    const staticBook = staticBooks.find((b) => b.id === item.bookId || b.slug === item.bookId);
    const meta = item.meta ?? (staticBook ? fromStaticBook(staticBook) : undefined);
    const savedCover = str(item.coverUrl);

    return {
      slug: meta?.slug ?? item.bookId,
      title: meta?.title ?? item.title,
      language: meta?.language ? formatLanguage(meta.language) : undefined,
      region: meta?.region,
      level: meta?.level ? formatLevel(meta.level) : undefined,
      cover: meta?.cover ?? savedCover ?? "/covers/default.jpg",
      description: meta?.description,
      statsLine: meta?.statsLine,
      topicsLine: meta?.topicsLine,
      bookId: item.bookId,
    };
  });
}

export function toStoryItems(rows: LibraryStoryRow[], staticBooks: Book[]): StoryItem[] {
  const items: StoryItem[] = [];

  for (const item of rows) {
    const isLooseStory = item.bookId === "polyglot" || item.bookId === "standalone";
    const savedCover = str(item.coverUrl);

    if (isLooseStory) {
      // A loose story with no slug has no reachable destination anywhere:
      // /stories/[slug] is the only route that serves it.
      if (!item.storySlug) continue;
      items.push({
        id: item.id,
        storyId: item.storyId,
        href: `/stories/${item.storySlug}?${RETURN_QUERY}`,
        title: item.title,
        bookTitle: item.bookId === "standalone" ? "Individual Stories" : "Polyglot Stories",
        language: formatLanguage(item.language),
        region: item.region,
        level: formatLevel(item.level),
        topic: item.topic,
        coverUrl: savedCover ?? "/covers/default.jpg",
        audioUrl: item.audioUrl ?? null,
      });
      continue;
    }

    const staticBook = staticBooks.find((b) => b.id === item.bookId || b.slug === item.bookId);
    const staticStory = staticBook?.stories.find(
      (s) => s.id === item.storyId || s.slug === item.storyId
    );

    const bookSlug = item.meta?.bookSlug ?? staticBook?.slug ?? item.bookSlug ?? item.bookId;
    const storySlug = item.meta?.storySlug ?? staticStory?.slug ?? item.storySlug;
    const language = item.meta?.language ?? item.language ?? staticStory?.language ?? staticBook?.language;
    const region = item.meta?.region ?? item.region ?? staticStory?.region ?? staticBook?.region;
    const level = item.meta?.level ?? item.level ?? staticStory?.level ?? staticBook?.level;

    items.push({
      id: item.id,
      storyId: item.storyId,
      // Without a story slug the story page cannot be reached, but the book
      // page still can: land the reader there instead of hiding the row.
      href: storySlug
        ? `/books/${bookSlug}/${storySlug}?${RETURN_QUERY}`
        : `/books/${bookSlug}?from=my-library`,
      title: str(item.title) ?? item.meta?.title ?? staticStory?.title ?? "",
      // Last resort: derive a readable book name from the slug rather than
      // leaving the card without a subtitle.
      bookTitle: item.meta?.bookTitle ?? staticBook?.title ?? titleFromSlug(item.bookId),
      language: language ? formatLanguage(language) : "",
      region,
      level: level ? formatLevel(level) : "",
      topic:
        item.meta?.topic ??
        item.topic ??
        str(staticStory?.topic) ??
        str(staticBook?.topic),
      coverUrl:
        item.meta?.coverUrl ??
        str(staticStory?.cover) ??
        savedCover ??
        str(staticBook?.cover) ??
        "/covers/default.jpg",
      audioUrl: item.meta?.audioUrl ?? item.audioUrl ?? str(staticStory?.audio) ?? null,
    });
  }

  return items;
}
