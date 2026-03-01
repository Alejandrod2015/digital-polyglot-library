import Link from "next/link";
import { books } from "@/data/books";
import { currentUser } from "@clerk/nextjs/server";
import type { Book } from "@/types/books";
import BookHorizontalCard from "@/components/BookHorizontalCard";
import { formatLanguage, formatLevel } from "@/lib/displayFormat";

type ExploreBooksPageProps = {
  searchParams: Promise<{ topic?: string }>;
};

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((i) => typeof i === "string");
}

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

export default async function ExploreBooksPage({ searchParams }: ExploreBooksPageProps) {
  const { topic } = await searchParams;
  const topicKey = normalizeTopicKey(topic ?? "");

  const user = await currentUser();
  const targetLanguagesUnknown = (user?.publicMetadata?.targetLanguages as unknown) ?? [];
  const targetLanguages =
    isStringArray(targetLanguagesUnknown) && targetLanguagesUnknown.length > 0
      ? new Set(targetLanguagesUnknown.map((l) => l.toLowerCase()))
      : null;

  const allBooks = Object.values(books) as Book[];
  const filteredByLanguage = targetLanguages
    ? allBooks.filter((book) => {
        return typeof book.language === "string" && targetLanguages.has(book.language.toLowerCase());
      })
    : allBooks;

  const filteredBooks = topicKey
    ? filteredByLanguage.filter((book) =>
        extractBookTopics(book).some((t) => normalizeTopicKey(t) === topicKey)
      )
    : filteredByLanguage;

  return (
    <div className="max-w-6xl mx-auto p-8 text-white">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">All Books</h1>
        <Link href="/explore" className="text-sm text-blue-300 hover:text-blue-200">
          Back to Explore
        </Link>
      </div>

      {filteredBooks.length === 0 ? (
        <p className="text-gray-400">No books found.</p>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
          {filteredBooks.map((book) => {
            const slug = book.slug;
            const title = book.title || "Untitled book";
            const cover =
              typeof book.cover === "string" && book.cover.trim() !== ""
                ? book.cover
                : "/covers/default.jpg";
            const language = formatLanguage(book.language);
            const level = formatLevel(book.level);
            const meta = `${language} · ${level}`;

            return (
              <BookHorizontalCard
                key={slug || title}
                title={title}
                cover={cover}
                meta={meta}
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
