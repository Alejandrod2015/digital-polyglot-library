// /src/app/explore/ExploreClient.tsx

"use client";

import Link from "next/link";
import { books } from "@/data/books";
import StoryCarousel from "@/components/StoryCarousel";
import { useUser } from "@clerk/nextjs";
import { useMemo } from "react";
import dynamic from "next/dynamic";

// ⬇️ monta BookCarousel únicamente en cliente (sin SSR)
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

export default function ExploreClient({ polyglotStories }: ExploreClientProps) {
  const { user } = useUser();

  const targetLanguages =
    (user?.publicMetadata?.targetLanguages as unknown) ?? [];

  const { filteredBooks, filteredStories } = useMemo(() => {
    const allBooks = Object.values(books);

    if (
      Array.isArray(targetLanguages) &&
      targetLanguages.every((i) => typeof i === "string") &&
      targetLanguages.length > 0
    ) {
      const langs = new Set(targetLanguages.map((l) => l.toLowerCase()));
      return {
        filteredBooks: allBooks.filter(
          (b) =>
            typeof b.language === "string" &&
            langs.has(b.language.toLowerCase())
        ),
        filteredStories: polyglotStories.filter(
          (s) =>
            typeof s.language === "string" &&
            langs.has(s.language.toLowerCase())
        ),
      };
    }

    return {
      filteredBooks: allBooks,
      filteredStories: polyglotStories,
    };
  }, [polyglotStories, targetLanguages]);

  const safeBooks = Array.isArray(filteredBooks) ? filteredBooks : [];
  const safeStories = Array.isArray(filteredStories) ? filteredStories : [];

  return (
    <div className="-mx-4">
      <div className="max-w-6xl mx-auto p-8 text-white">
        <h1 className="text-3xl font-bold mb-8">Explore</h1>

        {/* 🔹 Books */}
        <h2 className="text-2xl font-semibold mb-6 text-blue-400">Books</h2>
        {safeBooks.length === 0 ? (
          <p className="text-gray-400">
            {Array.isArray(targetLanguages) && targetLanguages.length > 0
              ? "No books found in your selected languages."
              : "No books available."}
          </p>
        ) : (
          <BookCarousel
            className="mb-16"
            items={safeBooks.map((book) => ({
              slug: book.slug,
              title: book.title,
              language: capitalize(book.language),
              level: capitalize(book.level),
              cover: book.cover,
              bookId: book.id, // ✅ necesario para BookCarousel actual
            }))}
          />
        )}

        {/* 🔹 Polyglot Stories */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-emerald-400">
            Polyglot Stories
          </h2>

          {safeStories.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center text-gray-400 bg-white/5 rounded-2xl">
              {Array.isArray(targetLanguages) && targetLanguages.length > 0
                ? "No stories found in your selected languages."
                : "No Polyglot stories have been published yet."}
            </div>
          ) : (
            <div className="min-h-[320px]">
              <StoryCarousel
                items={safeStories}
                renderItem={(story) => (
                  <Link
                    key={story.id}
                    href={`/stories/${story.slug}`}
                    className="flex flex-col bg-white/5 hover:bg-white/10 transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full"
                  >
                    {/* 🔹 Imagen de portada */}
                    <div className="w-full h-48 bg-gray-800">
                      <img
                        src={story.coverUrl || "/covers/default.png"}
                        alt={story.title}
                        className="object-cover w-full h-full"
                      />
                    </div>

                    <div className="p-5 flex flex-col justify-between flex-1 text-left">
                      <div>
                        <h3 className="text-xl font-semibold mb-2 text-white">
                          {story.title}
                        </h3>
                        <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">
                          {story.text?.replace(/<[^>]+>/g, "").slice(0, 120) ??
                            ""}
                          ...
                        </p>
                      </div>
                      <div className="mt-3 text-sm text-gray-400 space-y-1">
                        {story.language && (
                          <p>
                            <span className="font-semibold text-gray-300">
                              Language:
                            </span>{" "}
                            {story.language}
                          </p>
                        )}
                        {story.level && (
                          <p>
                            <span className="font-semibold text-gray-300">
                              Level:
                            </span>{" "}
                              {story.level}
                          </p>
                        )}
                      </div>
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
