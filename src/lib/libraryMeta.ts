// Resolves display metadata for My Library rows against the REAL catalog
// (CatalogBook / CatalogStory), with the legacy static dump as a fallback.
//
// WHY (2026-07-28): MyLibraryClient used to resolve every LibraryBook /
// LibraryStory row against `@/data/books` (the static dump, 4 books in prod)
// and dropped with `continue` anything it could not find. A buyer of a title
// missing from the dump (Venice, Portuguese, Argentinian, Mexican) never saw
// the book in My Library; one customer bought the same book twice thinking
// the purchase had failed. The dump is a build-time snapshot; the catalog
// tables are the truth, so the lookup happens here, server-side, and the
// client renders the saved title/cover when even this returns nothing.

import { books as staticBooks } from "@/data/books";
import { getCatalogBooksBySlugs } from "@/lib/catalog";
import { resolvePublicMediaUrl } from "@/lib/publicMedia";
import { getBookCardMeta } from "@domain/bookCardMeta";
import type { Book, Story } from "@domain/types/books";
import type { LibraryBookMeta, LibraryStoryMeta } from "@/types/libraryMeta";

export type { LibraryBookMeta, LibraryStoryMeta };

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * Catalog first, static dump second, for the given book slugs. Slugs that
 * exist in neither source are simply absent from the map.
 */
async function resolveBooks(bookIds: string[]): Promise<Map<string, Book>> {
  const wanted = Array.from(new Set(bookIds.filter((id) => typeof id === "string" && id !== "")));
  const resolved = new Map<string, Book>();
  if (wanted.length === 0) return resolved;

  for (const id of wanted) {
    const fallback = Object.values(staticBooks).find((b) => b.id === id || b.slug === id);
    if (fallback) resolved.set(id, fallback);
  }

  try {
    for (const book of await getCatalogBooksBySlugs(wanted)) {
      // The catalog wins over the dump: the dump is a snapshot of it.
      if (wanted.includes(book.slug)) resolved.set(book.slug, book);
      if (book.id !== book.slug && wanted.includes(book.id)) resolved.set(book.id, book);
    }
  } catch (err) {
    // A catalog read failure must not empty the library: the static dump
    // entries stay, and unresolved rows still render from their saved fields.
    console.error("⚠️ libraryMeta: catalog lookup failed, using static dump only:", err);
  }

  return resolved;
}

function toBookMeta(book: Book): LibraryBookMeta {
  const card = getBookCardMeta(book);
  return {
    slug: book.slug,
    title: book.title,
    description: str(book.description),
    cover: resolvePublicMediaUrl(str(book.cover)),
    language: str(book.language),
    region: str(book.region),
    level: str(book.level),
    published: book.published,
    statsLine: card.statsLine,
    topicsLine: card.topicsLine,
  };
}

/** Keyed by the exact `bookId` stored in LibraryBook. */
export async function resolveLibraryBookMeta(
  bookIds: string[]
): Promise<Map<string, LibraryBookMeta>> {
  const books = await resolveBooks(bookIds);
  const out = new Map<string, LibraryBookMeta>();
  for (const [bookId, book] of books) out.set(bookId, toBookMeta(book));
  return out;
}

function findStory(book: Book, storyId: string): Story | undefined {
  return book.stories.find((s) => s.id === storyId || s.slug === storyId);
}

export function libraryStoryKey(bookId: string, storyId: string): string {
  return `${bookId}::${storyId}`;
}

/**
 * Keyed by `${bookId}::${storyId}`. Only book-backed rows are resolved here;
 * "polyglot" / "standalone" rows are enriched from their own tables in
 * /api/library.
 */
export async function resolveLibraryStoryMeta(
  rows: Array<{ bookId: string; storyId: string }>
): Promise<Map<string, LibraryStoryMeta>> {
  const books = await resolveBooks(rows.map((r) => r.bookId));
  const out = new Map<string, LibraryStoryMeta>();

  for (const row of rows) {
    const book = books.get(row.bookId);
    if (!book) continue;
    const story = findStory(book, row.storyId);
    if (!story) continue;

    out.set(libraryStoryKey(row.bookId, row.storyId), {
      bookSlug: book.slug,
      bookTitle: book.title,
      storySlug: story.slug,
      title: story.title,
      language: str(story.language) ?? str(book.language),
      region: str(story.region) ?? str(book.region),
      level: str(story.level) ?? str(book.level),
      topic: str(story.topic) ?? str(book.topic),
      coverUrl:
        resolvePublicMediaUrl(str(story.coverUrl) ?? str(story.cover)) ??
        resolvePublicMediaUrl(str(book.cover)),
      audioUrl: str(story.audio) ?? null,
    });
  }

  return out;
}
