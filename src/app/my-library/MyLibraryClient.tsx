"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { books } from "@/data/books";
import Skeleton from "@/components/Skeleton";
import StoryCarousel from "@/components/StoryCarousel";
import BookCarousel from "@/components/BookCarousel";
import Link from "next/link";
import Cover from "@/components/Cover";

type LibraryBook = {
  id: string;
  bookId: string;
  title: string;
  coverUrl: string;
};

type LibraryStory = {
  id: string;
  storyId: string;
  bookId: string;
  title: string;
  coverUrl: string;
};

type BookCarouselItem = {
  slug: string;
  title: string;
  language?: string;
  level?: string;
  cover?: string;
  bookId: string;
};

type StoryItem = {
  id: string;
  storyId: string;
  bookSlug: string;
  storySlug: string;
  title: string;
  bookTitle: string;
  language: string;
  level: string;
  coverUrl?: string;
};

const capitalize = (v?: string) =>
  v ? v.charAt(0).toUpperCase() + v.slice(1) : "—";

export default function MyLibraryClient() {
  const { user, isLoaded } = useUser();
  const [booksList, setBooksList] = useState<LibraryBook[]>([]);
  const [stories, setStories] = useState<LibraryStory[]>([]);
  const [loading, setLoading] = useState(true);

  // ------------------------------
  // LOAD LIBRARY
  // ------------------------------
  useEffect(() => {
    if (!isLoaded) return;

    const load = async () => {
      if (!user) {
        setBooksList([]);
        setStories([]);
        setLoading(false);
        return;
      }

      try {
        const [booksRes, storiesRes] = await Promise.all([
          fetch("/api/library?type=book", { cache: "no-store" }),
          fetch("/api/library?type=story", { cache: "no-store" }),
        ]);

        const rawBooks: unknown = booksRes.ok ? await booksRes.json() : [];
        const rawStories: unknown = storiesRes.ok ? await storiesRes.json() : [];

        if (Array.isArray(rawBooks)) {
          setBooksList(
            rawBooks.filter(
              (b): b is LibraryBook =>
                typeof b === "object" &&
                b !== null &&
                typeof (b as LibraryBook).id === "string" &&
                typeof (b as LibraryBook).bookId === "string" &&
                typeof (b as LibraryBook).title === "string" &&
                typeof (b as LibraryBook).coverUrl === "string"
            )
          );
        }

        if (Array.isArray(rawStories)) {
          setStories(
            rawStories.filter(
              (s): s is LibraryStory =>
                typeof s === "object" &&
                s !== null &&
                typeof (s as LibraryStory).id === "string" &&
                typeof (s as LibraryStory).storyId === "string" &&
                typeof (s as LibraryStory).bookId === "string" &&
                typeof (s as LibraryStory).title === "string" &&
                typeof (s as LibraryStory).coverUrl === "string"
            )
          );
        }
      } catch {
        setBooksList([]);
        setStories([]);
      } finally {
        setTimeout(() => setLoading(false), 150);
      }
    };

    void load();
  }, [user, isLoaded]);

  // ------------------------------
  // REMOVE ITEM
  // ------------------------------
  const removeItem = async (type: "books" | "stories", id: string) => {
    if (type === "books") {
      setBooksList((prev) => prev.filter((b) => b.bookId !== id));
      await fetch("/api/library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "book", bookId: id }),
      });
    } else {
      setStories((prev) => prev.filter((s) => s.storyId !== id));
      await fetch("/api/library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "story", storyId: id }),
      });
    }
  };

  const allBooks = useMemo(() => Object.values(books), []);

  // ------------------------------
  // MAP BOOKS → CAROUSEL ITEMS
  // ------------------------------
  const bookCarouselItems = useMemo<BookCarouselItem[]>(() => {
    const arr: BookCarouselItem[] = [];

    for (const item of booksList) {
      const meta = allBooks.find((b) => b.id === item.bookId);
      if (!meta) continue;

      arr.push({
        slug: meta.slug,
        title: meta.title,
        language:
          typeof meta.language === "string" ? capitalize(meta.language) : undefined,
        level:
          typeof meta.level === "string" ? capitalize(meta.level) : undefined,
        cover: meta.cover,
        bookId: item.bookId,
      });
    }

    return arr;
  }, [booksList, allBooks]);

  // ------------------------------
  // MAP STORIES
  // ------------------------------
  const storyItems = useMemo<StoryItem[]>(() => {
    const arr: StoryItem[] = [];

    for (const item of stories) {
      const bookMeta = allBooks.find((b) => b.id === item.bookId);
      if (!bookMeta) continue;

      const storyMeta = bookMeta.stories.find((s) => s.id === item.storyId);
      if (!storyMeta) continue;

      arr.push({
        id: item.id,
        storyId: item.storyId,
        bookSlug: bookMeta.slug,
        storySlug: storyMeta.slug,
        title: item.title || storyMeta.title,
        bookTitle: bookMeta.title,
        language:
        typeof storyMeta.language === "string"
          ? capitalize(storyMeta.language)
          : capitalize(bookMeta.language),

      level:
        typeof storyMeta.level === "string"
          ? capitalize(storyMeta.level)
          : capitalize(bookMeta.level),
        coverUrl:
          item.coverUrl && item.coverUrl.trim() !== ""
            ? item.coverUrl
            : bookMeta.cover,
      });
    }

    return arr;
  }, [stories, allBooks]);

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <div className="w-full mx-auto px-3 sm:px-4 lg:px-6 py-8 text-white">
      <h1 className="text-3xl font-bold mb-6">My Library</h1>

      {/* SKELETON */}
      {loading && (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 place-items-center">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/5 p-4 rounded-2xl shadow animate-pulse w-full max-w-[240px]"
            >
              <div className="w-full h-48 bg-white/10 rounded-xl mb-3" />
              <Skeleton lines={2} />
            </div>
          ))}
        </div>
      )}

      {/* CONTENT */}
      {!loading && (
        <>
          {/* BOOKS */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6 text-blue-400">
              Your Books
            </h2>

            {bookCarouselItems.length === 0 ? (
              <p className="text-gray-400">You haven’t saved any books yet.</p>
            ) : (
              <BookCarousel
                items={bookCarouselItems}
                renderActions={(book) => (
                  <button
                    type="button"
                    onClick={() => removeItem("books", book.bookId)}
                    className="text-sm text-red-400 hover:text-red-500 font-medium"
                  >
                    Remove
                  </button>
                )}
              />
            )}
          </section>

          {/* STORIES */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6 text-emerald-400">
              Your Saved Stories
            </h2>

            {storyItems.length === 0 ? (
              <p className="text-gray-400">
                You haven’t saved any stories yet.
              </p>
            ) : (
              <StoryCarousel<StoryItem>
                items={storyItems}
                renderItem={(story) => (
                  <div className="flex flex-col h-full scale-[0.94] origin-top">
                    <Link
                      href={`/books/${story.bookSlug}/${story.storySlug}?from=my-library`}
                      className="flex flex-col bg-white/5 hover:bg-white/10 transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full"
                    >
                      {/* 🔹 Imagen de portada (igual que Explore) */}
                      <div className="w-full h-48 bg-gray-800">
                        <img
                          src={story.coverUrl || "/covers/default.png"}
                          alt={story.title}
                          className="object-cover w-full h-full"
                          onError={(e) => {
                            e.currentTarget.src = "/covers/default.png";
                          }}
                        />
                      </div>

                      <div className="p-5 flex flex-col justify-between flex-1 text-left">
                        <div>
                          <h3 className="text-xl font-semibold mb-2 text-white">
                            {story.title}
                          </h3>
                          <p className="text-sm text-blue-300">
                            {story.bookTitle}
                          </p>
                          {/* No tenemos resumen aquí, así que omitimos el párrafo de texto */}
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

                    <button
                      type="button"
                      onClick={() => removeItem("stories", story.storyId)}
                      className="flex items-center justify-center gap-2 text-gray-400 hover:text-red-500 transition-colors text-sm font-medium border-t border-white/5 py-2"
                    >
                      Remove
                    </button>
                  </div>
                )}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
