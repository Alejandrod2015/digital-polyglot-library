import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { books } from "@/data/books";
import type { Book } from "@/types/books";
import BookHorizontalCard from "@/components/BookHorizontalCard";
import { getBookCardMeta } from "@domain/bookCardMeta";

type ExploreBooksPageProps = {
  searchParams: Promise<{ topic?: string; language?: string; region?: string }>;
};

export const revalidate = 300;

function normalizeTopicKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toTopicList(value: unknown): string[] {
  if (typeof value === "string") {
    const v = value.trim();
    return v ? [v] : [];
  }
  if (Array.isArray(value)) {
    return value.filter((i): i is string => typeof i === "string" && i.trim() !== "");
  }
  return [];
}

function extractBookTopics(book: Book): string[] {
  return [...toTopicList(book.topic), ...toTopicList(book.theme)];
}

function toLanguageKeys(value: unknown): Set<string> | null {
  if (!Array.isArray(value)) return null;
  const keys = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeTopicKey(item))
    .filter(Boolean);
  return keys.length > 0 ? new Set(keys) : null;
}

export default async function ExploreBooksPage({ searchParams }: ExploreBooksPageProps) {
  const [{ topic, language, region }, user] = await Promise.all([searchParams, currentUser()]);
  const topicKey = normalizeTopicKey(topic ?? "");
  const languageKey = normalizeTopicKey(language ?? "");
  const preferredLanguageKeys = toLanguageKeys(user?.publicMetadata?.targetLanguages);
  const regionKey = normalizeTopicKey(
    region ??
      (typeof user?.publicMetadata?.preferredRegion === "string"
        ? user.publicMetadata.preferredRegion
        : "")
  );

  const allBooks = Object.values(books) as Book[];
  const languageFilteredBooks = languageKey
    ? allBooks.filter((book) => normalizeTopicKey(book.language) === languageKey)
    : preferredLanguageKeys
      ? allBooks.filter((book) => preferredLanguageKeys.has(normalizeTopicKey(book.language)))
      : allBooks;
  const regionFilteredBooks = regionKey
    ? languageFilteredBooks.filter((book) => normalizeTopicKey(book.region ?? "") === regionKey)
    : languageFilteredBooks;
  const filteredBooks = topicKey
    ? regionFilteredBooks.filter((book) =>
        extractBookTopics(book).some((t) => normalizeTopicKey(t) === topicKey)
      )
    : regionFilteredBooks;

  return (
    <div className="max-w-6xl mx-auto p-8 text-[var(--foreground)]">
      <div className="mb-6 md:mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">All Books</h1>
        <Link href="/explore" className="text-sm text-white/90 hover:text-white">
          Back to Explore
        </Link>
      </div>

      {filteredBooks.length === 0 ? (
        <p className="text-[var(--muted)]">No books found.</p>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
          {filteredBooks.map((book) => {
            const slug = book.slug;
            const title = book.title || "Untitled book";
            const cover =
              typeof book.cover === "string" && book.cover.trim() !== ""
                ? book.cover
                : "/covers/default.jpg";
            return (
              <BookHorizontalCard
                key={slug || title}
                title={title}
                cover={cover}
                level={book.level}
                language={book.language}
                region={book.region}
                statsLine={getBookCardMeta(book).statsLine}
                topicsLine={getBookCardMeta(book).topicsLine}
                description={book.description}
                href={`/books/${slug}?returnTo=/explore/books&returnLabel=All%20Books`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
