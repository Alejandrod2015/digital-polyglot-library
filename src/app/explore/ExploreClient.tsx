"use client";

import Link from "next/link";
import { books } from "@/data/books";
import StoryCarousel from "@/components/StoryCarousel";
import { useUser } from "@clerk/nextjs";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import ExploreSearch from "@/components/ExploreSearch";

const BookCarousel = dynamic(() => import("@/components/BookCarousel"), {
  ssr: false,
});

const capitalize = (value?: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : "—";

type UserStory = {
  id: string;
  slug: string;
  title: string;
  language: string;
  level: string;
  text: string;
  coverUrl?: string;
};

type ExploreClientProps = {
  polyglotStories: UserStory[];
};

type BookStoryItem = {
  id: string;
  bookSlug: string;
  bookTitle: string;
  storySlug: string;
  storyTitle: string;
  language: string;
  level: string;
  coverUrl: string;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function getString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((i) => typeof i === "string");
}

function normalizeCoverUrl(raw: string | null | undefined): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return "/covers/default.jpg";

  // Mantén el mismo patrón que en otras partes: si viene del CDN, optimiza.
  if (v.startsWith("https://cdn.sanity.io/")) {
    return `${v}?w=800&fit=crop&auto=format`;
  }

  return v;
}

function extractBookStories(allBooksUnknown: unknown[]): BookStoryItem[] {
  const out: BookStoryItem[] = [];

  for (const b of allBooksUnknown) {
    if (!isRecord(b)) continue;

    const bookSlug = getString(b, "slug");
    const bookTitle = getString(b, "title") ?? "";
    const language = getString(b, "language") ?? "";
    const level = getString(b, "level") ?? "";
    const bookCover = normalizeCoverUrl(getString(b, "cover"));

    if (!bookSlug) continue;

    const pushStory = (story: unknown, index: number) => {
      if (!isRecord(story)) return;

      const storySlug = getString(story, "slug");
      const storyTitle = getString(story, "title") ?? "";
      const storyCover = normalizeCoverUrl(getString(story, "cover"));
      const coverUrl = storyCover !== "/covers/default.jpg" ? storyCover : bookCover;

      if (!storySlug) return;

      out.push({
        id: `${bookSlug}:${storySlug}:${index}`,
        bookSlug,
        bookTitle,
        storySlug,
        storyTitle,
        language,
        level,
        coverUrl,
      });
    };

    const directStories = b["stories"];
    if (Array.isArray(directStories)) {
      directStories.forEach((s, i) => pushStory(s, i));
      continue;
    }

    const sections = b["sections"];
    if (Array.isArray(sections)) {
      for (const section of sections) {
        if (!isRecord(section)) continue;
        const sectionStories = section["stories"];
        if (!Array.isArray(sectionStories)) continue;
        sectionStories.forEach((s, i) => pushStory(s, i));
      }
    }
  }

  return out;
}

export default function ExploreClient({ polyglotStories }: ExploreClientProps) {
  const { user } = useUser();

  const targetLanguages = (user?.publicMetadata?.targetLanguages as unknown) ?? [];

  const { filteredBooks, filteredPolyglotStories, allFilteredBookStories, previewBookStories } =
    useMemo(() => {
      const allBooks = Object.values(books) as unknown[];
      const allBookStories = extractBookStories(allBooks);

      const langs =
        isStringArray(targetLanguages) && targetLanguages.length > 0
          ? new Set(targetLanguages.map((l) => l.toLowerCase()))
          : null;

      const filteredB = langs
        ? allBooks.filter((book) => {
            if (!isRecord(book)) return false;
            const lang = getString(book, "language");
            return typeof lang === "string" && langs.has(lang.toLowerCase());
          })
        : allBooks;

      const filteredS = langs
        ? polyglotStories.filter(
            (s) => typeof s.language === "string" && langs.has(s.language.toLowerCase())
          )
        : polyglotStories;

      const filteredBookS = langs
        ? allBookStories.filter(
            (s) => typeof s.language === "string" && langs.has(s.language.toLowerCase())
          )
        : allBookStories;

      const preview = filteredBookS.slice(0, 18);

      return {
        filteredBooks: filteredB,
        filteredPolyglotStories: filteredS,
        allFilteredBookStories: filteredBookS,
        previewBookStories: preview,
      };
    }, [polyglotStories, targetLanguages]);

  const safeBooks = Array.isArray(filteredBooks) ? filteredBooks : [];
  const safePolyglotStories = Array.isArray(filteredPolyglotStories) ? filteredPolyglotStories : [];
  const safePreviewBookStories = Array.isArray(previewBookStories) ? previewBookStories : [];
  const safeAllFilteredBookStories = Array.isArray(allFilteredBookStories)
    ? allFilteredBookStories
    : [];

  return (
    <div className="-mx-4">
      <div className="max-w-6xl mx-auto p-8 text-white">
        <h1 className="text-3xl font-bold mb-6">Explore</h1>

        <ExploreSearch
          className="mb-10"
          books={safeBooks}
          bookStories={safeAllFilteredBookStories}
          polyglotStories={safePolyglotStories}
        />

        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-emerald-400">Book Stories</h2>

          {safePreviewBookStories.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-gray-400 bg-white/5 rounded-2xl">
              {isStringArray(targetLanguages) && targetLanguages.length > 0
                ? "No book stories found in your selected languages."
                : "No book stories available."}
            </div>
          ) : (
            <div className="min-h-[240px]">
              <StoryCarousel
                items={safePreviewBookStories}
                renderItem={(s) => (
                  <Link
                    key={s.id}
                    href={`/books/${s.bookSlug}/${s.storySlug}`}
                    className="flex flex-col bg-white/5 hover:bg-white/10 transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full"
                  >
                    <div className="w-full h-48 bg-gray-800">
                      <img
                        src={s.coverUrl}
                        alt={s.storyTitle}
                        className="object-cover w-full h-full"
                      />
                    </div>

                    <div className="p-5 flex flex-col justify-between flex-1 text-left">
                      <div>
                        <h3 className="text-xl font-semibold mb-2 text-white line-clamp-2">
                          {s.storyTitle || "Untitled story"}
                        </h3>
                        <p className="text-sky-300 text-sm leading-relaxed line-clamp-1">
                          {s.bookTitle || s.bookSlug}
                        </p>
                      </div>

                      <p className="mt-3 text-sm text-gray-400">
                        {capitalize(s.language)} · {capitalize(s.level)}
                      </p>
                    </div>
                  </Link>
                )}
              />
            </div>
          )}
        </div>

        <h2 className="text-2xl font-semibold mb-6 text-blue-400">Books</h2>
        {safeBooks.length === 0 ? (
          <p className="text-gray-400">
            {isStringArray(targetLanguages) && targetLanguages.length > 0
              ? "No books found in your selected languages."
              : "No books available."}
          </p>
        ) : (
          <BookCarousel
            className="mb-16"
            items={safeBooks.map((book) => {
              if (!isRecord(book)) {
                return {
                  slug: "",
                  title: "",
                  language: "—",
                  level: "—",
                  cover: "/covers/default.jpg",
                  bookId: "",
                };
              }

              const slug = getString(book, "slug") ?? "";
              const title = getString(book, "title") ?? "";
              const language = capitalize(getString(book, "language") ?? undefined);
              const level = capitalize(getString(book, "level") ?? undefined);
              const cover = normalizeCoverUrl(getString(book, "cover"));
              const bookId = getString(book, "id") ?? "";

              return { slug, title, language, level, cover, bookId };
            })}
          />
        )}

        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-emerald-400">Polyglot Stories</h2>

          {safePolyglotStories.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center text-gray-400 bg-white/5 rounded-2xl">
              {isStringArray(targetLanguages) && targetLanguages.length > 0
                ? "No stories found in your selected languages."
                : "No Polyglot stories have been published yet."}
            </div>
          ) : (
            <div className="min-h-[320px]">
              <StoryCarousel
                items={safePolyglotStories}
                renderItem={(story) => (
                  <Link
                    key={story.id}
                    href={`/stories/${story.slug}`}
                    className="flex flex-col bg-white/5 hover:bg-white/10 transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full"
                  >
                    <div className="w-full h-48 bg-gray-800">
                      <img
                        src={
                          typeof story.coverUrl === "string" && story.coverUrl.trim() !== ""
                            ? story.coverUrl
                            : "/covers/default.jpg"
                        }
                        alt={story.title}
                        className="object-cover w-full h-full"
                      />
                    </div>

                    <div className="p-5 flex flex-col justify-between flex-1 text-left">
                      <div>
                        <h3 className="text-xl font-semibold mb-2 text-white">{story.title}</h3>
                        <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">
                          {(story.text ?? "").replace(/<[^>]+>/g, "").slice(0, 120)}...
                        </p>
                      </div>

                      <p className="mt-3 text-sm text-gray-400">
                        {capitalize(story.language)} · {capitalize(story.level)}
                      </p>
                    </div>
                  </Link>
                )}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}