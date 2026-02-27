"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Cover from "@/components/Cover";
import StoryCarousel from "@/components/StoryCarousel";
import ReleaseCarousel from "@/components/ReleaseCarousel";

type LatestBook = {
  slug: string;
  title: string;
  language?: string;
  level?: string;
  cover?: string;
};

type LatestStory = {
  bookSlug: string;
  bookTitle: string;
  storySlug: string;
  storyTitle: string;
  language?: string;
  level?: string;
  coverUrl: string;
};

type LatestPolyglotStory = {
  slug: string;
  title: string;
  language?: string;
  level?: string;
  text?: string;
  coverUrl?: string;
};

type ContinueItem = { id: string; title: string; cover: string };

type Props = {
  latestBooks: LatestBook[];
  latestStories: LatestStory[];
  latestPolyglotStories: LatestPolyglotStory[];
};

const MOBILE_LIMIT = 6;
const DESKTOP_LIMIT = 10;

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((i) => typeof i === "string");
}

function capitalize(value?: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "—";
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, "");
}

function VerticalCard(props: {
  title: string;
  cover?: string;
  meta?: string;
  onClick: () => void;
}) {
  const { title, cover, meta, onClick } = props;

  return (
    <div
      onClick={onClick}
      className="bg-white/5 hover:bg-white/10 rounded-2xl overflow-hidden shadow-md transition-all flex flex-col h-full cursor-pointer"
    >
      <div className="aspect-[2/3] w-full">
        <Cover src={cover ?? "/covers/default.jpg"} alt={title} className="w-full" />
      </div>

      <div className="p-4 text-left flex-1">
        <p className="text-base font-semibold text-white line-clamp-2">{title}</p>
        {meta ? <p className="text-sm text-gray-400 mt-1">{meta}</p> : null}
      </div>
    </div>
  );
}

export default function HomeClient({
  latestBooks,
  latestStories,
  latestPolyglotStories,
}: Props) {
  const router = useRouter();
  const { user } = useUser();

  const [continueListening, setContinueListening] = useState<ContinueItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dp_continue_listening_v1");
      if (!raw) return;

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      const safe = parsed.filter((i: unknown): i is ContinueItem => {
        if (typeof i !== "object" || i === null) return false;
        const r = i as Record<string, unknown>;
        return (
          typeof r.id === "string" &&
          typeof r.title === "string" &&
          typeof r.cover === "string"
        );
      });

      setContinueListening(safe);
    } catch {
      // ignora datos corruptos
    }
  }, []);

  const targetLanguagesUnknown = (user?.publicMetadata?.targetLanguages ?? []) as unknown;

  const languageFilter = useMemo(() => {
    if (!isStringArray(targetLanguagesUnknown) || targetLanguagesUnknown.length === 0)
      return null;
    return new Set(targetLanguagesUnknown.map((l) => l.toLowerCase()));
  }, [targetLanguagesUnknown]);

  const filteredBooks = useMemo(() => {
    if (!languageFilter) return latestBooks;
    return latestBooks.filter((b) => languageFilter.has((b.language ?? "").toLowerCase()));
  }, [latestBooks, languageFilter]);

  const filteredStories = useMemo(() => {
    if (!languageFilter) return latestStories;
    return latestStories.filter((s) => languageFilter.has((s.language ?? "").toLowerCase()));
  }, [latestStories, languageFilter]);

  const filteredPolyglot = useMemo(() => {
    if (!languageFilter) return latestPolyglotStories;
    return latestPolyglotStories.filter((s) =>
      languageFilter.has((s.language ?? "").toLowerCase())
    );
  }, [latestPolyglotStories, languageFilter]);

  const storiesForHome = filteredStories.slice(0, DESKTOP_LIMIT);
  const polyglotForHome = filteredPolyglot.slice(0, DESKTOP_LIMIT);

  return (
    <main className="min-h-screen bg-[#0D1B2A] text-white flex flex-col items-center px-8 pb-28 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
      {/* Latest Books */}
      <section className="mb-12 text-center w-full max-w-5xl pt-10">
        <h2 className="text-2xl font-semibold mb-6">Latest Books</h2>

        <div className="grid md:hidden gap-8 grid-cols-1 sm:grid-cols-2 place-items-center">
          {filteredBooks.slice(0, MOBILE_LIMIT).map((book) => (
            <div
              key={book.slug}
              onClick={() => router.push(`/books/${book.slug}?from=home`)}
              className="flex items-center gap-6 w-full max-w-[480px] bg-white/5 rounded-2xl p-5 cursor-pointer hover:bg-white/10 hover:shadow-md transition-all duration-200"
            >
              <div className="w-[38%] sm:w-[35%] md:w-[120px] flex-shrink-0">
                <Cover src={book.cover ?? "/covers/default.jpg"} alt={book.title} />
              </div>
              <div className="flex flex-col justify-center text-left flex-1 text-white">
                <h3 className="font-semibold text-lg leading-snug mb-2 line-clamp-2">
                  {book.title}
                </h3>
                <div className="space-y-1 text-sm text-white/80">
                  <p>
                    <span className="font-medium text-white">Language:</span>{" "}
                    {capitalize(book.language)}
                  </p>
                  <p>
                    <span className="font-medium text-white">Level:</span> {capitalize(book.level)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block">
          <ReleaseCarousel
            items={filteredBooks.slice(0, DESKTOP_LIMIT)}
            renderItem={(book) => (
              <VerticalCard
                title={book.title}
                cover={book.cover}
                meta={`${capitalize(book.language)} · ${capitalize(book.level)}`}
                onClick={() => router.push(`/books/${book.slug}?from=home`)}
              />
            )}
          />
        </div>
      </section>

      {/* Latest Book Stories (mismas dimensiones que Explore) */}
      <section className="mb-12 text-center w-full max-w-5xl">
        <h2 className="text-2xl font-semibold mb-6 text-emerald-400">Latest Book Stories</h2>

        <div className="min-h-[240px]">
          <StoryCarousel
            items={storiesForHome}
            renderItem={(s) => (
              <div
                key={`${s.bookSlug}:${s.storySlug}`}
                onClick={() => router.push(`/books/${s.bookSlug}/${s.storySlug}?from=home`)}
                className="flex flex-col bg-white/5 hover:bg-white/10 transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
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
              </div>
            )}
          />
        </div>

        <div className="md:hidden mt-4 text-white/60 text-sm">
          Showing {Math.min(MOBILE_LIMIT, storiesForHome.length)} of {storiesForHome.length}
        </div>
      </section>

      {/* Latest Polyglot Stories (mismas dimensiones que Explore) */}
      <section className="mb-12 text-center w-full max-w-5xl">
        <h2 className="text-2xl font-semibold mb-6 text-emerald-400">Latest Polyglot Stories</h2>

        <div className="min-h-[320px]">
          <StoryCarousel
            items={polyglotForHome}
            renderItem={(story) => (
              <div
                key={story.slug}
                onClick={() => router.push(`/stories/${story.slug}?from=home`)}
                className="flex flex-col bg-white/5 hover:bg-white/10 transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
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
                      {stripHtml(story.text ?? "").slice(0, 120)}...
                    </p>
                  </div>

                  <p className="mt-3 text-sm text-gray-400">
                    {capitalize(story.language)} · {capitalize(story.level)}
                  </p>
                </div>
              </div>
            )}
          />
        </div>
      </section>

      {/* Continue listening */}
      {continueListening.length > 0 && (
        <section className="w-full max-w-5xl text-center">
          <h2 className="text-2xl font-semibold mb-6">Continue listening</h2>
          <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 place-items-center">
            {continueListening.map((item) => (
              <div
                key={item.id}
                onClick={() => router.push(`/books/${item.id}?from=home`)}
                className="flex items-center gap-6 w-full max-w-[480px] bg-white/5 rounded-2xl p-5 cursor-pointer hover:bg-white/10 hover:shadow-md transition-all duration-200"
              >
                <div className="w-[38%] sm:w-[35%] md:w-[120px] flex-shrink-0">
                  <Cover src={item.cover} alt={item.title} />
                </div>
                <div className="flex flex-col justify-center text-left flex-1 text-white">
                  <h3 className="font-semibold text-lg leading-snug mb-2 line-clamp-2">
                    {item.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}