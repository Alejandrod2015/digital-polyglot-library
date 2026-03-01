"use client";

import { useMemo, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import Cover from "@/components/Cover";
import StoryCarousel from "@/components/StoryCarousel";
import ReleaseCarousel from "@/components/ReleaseCarousel";
import { books } from "@/data/books";

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

type ContinueItem = {
  bookSlug: string;
  storySlug: string;
  title: string;
  bookTitle: string;
  cover: string;
  language?: string;
  level?: string;
  topic?: string;
  readMinutes?: number;
  audioDurationSec?: number;
};

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

function estimateReadMinutes(text?: string): number {
  const words = stripHtml(text ?? "")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

function capitalizeWords(value?: string) {
  if (!value) return "—";
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAudioDuration(totalSeconds?: number): string {
  if (!totalSeconds || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return "--:--";
  const rounded = Math.floor(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function VerticalCard(props: {
  title: string;
  cover?: string;
  meta?: string;
  href: string;
}) {
  const { title, cover, meta, href } = props;

  return (
    <Link
      href={href}
      className="bg-white/5 hover:bg-white/10 rounded-2xl overflow-hidden shadow-md transition-all flex flex-col h-full cursor-pointer"
    >
      <div className="aspect-[2/3] w-full">
        <Cover src={cover ?? "/covers/default.jpg"} alt={title} className="w-full" />
      </div>

      <div className="p-4 text-left flex-1">
        <p className="text-base font-semibold text-white line-clamp-2">{title}</p>
        {meta ? <p className="text-sm text-gray-400 mt-1">{meta}</p> : null}
      </div>
    </Link>
  );
}

export default function HomeClient({
  latestBooks,
  latestStories,
  latestPolyglotStories,
}: Props) {
  const { user } = useUser();

  const [continueListening, setContinueListening] = useState<ContinueItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dp_continue_listening_v1");
      if (!raw) return;

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      const safe = parsed
        .map((i: unknown): ContinueItem | null => {
          if (typeof i !== "object" || i === null) return null;
          const r = i as Record<string, unknown>;
          if (
            typeof r.bookSlug !== "string" ||
            typeof r.storySlug !== "string" ||
            typeof r.title !== "string" ||
            typeof r.bookTitle !== "string" ||
            typeof r.cover !== "string"
          ) {
            return null;
          }

          const bookMeta = Object.values(books).find((b) => b.slug === r.bookSlug);
          const storyMeta = bookMeta?.stories.find((s) => s.slug === r.storySlug);
          const language =
            typeof r.language === "string"
              ? r.language
              : storyMeta?.language ?? bookMeta?.language;
          const level =
            typeof r.level === "string" ? r.level : storyMeta?.level ?? bookMeta?.level;
          const topic =
            typeof r.topic === "string" ? r.topic : storyMeta?.topic ?? bookMeta?.topic;
          const readMinutes =
            typeof r.readMinutes === "number" && Number.isFinite(r.readMinutes)
              ? r.readMinutes
              : estimateReadMinutes(storyMeta?.text);
          const audioDurationSec =
            typeof r.audioDurationSec === "number" && Number.isFinite(r.audioDurationSec)
              ? r.audioDurationSec
              : undefined;

          return {
            bookSlug: r.bookSlug,
            storySlug: r.storySlug,
            title: r.title,
            bookTitle: r.bookTitle,
            cover: r.cover,
            language,
            level,
            topic,
            readMinutes,
            audioDurationSec,
          };
        })
        .filter((i): i is ContinueItem => i !== null);

      setContinueListening(safe);
    } catch {
      // ignora datos corruptos
    }
  }, []);

  useEffect(() => {
    if (continueListening.length === 0) return;

    const unresolved = continueListening.filter(
      (item) => !(typeof item.audioDurationSec === "number" && item.audioDurationSec > 0)
    );
    if (unresolved.length === 0) return;

    let cancelled = false;

    const loadDuration = (item: ContinueItem) =>
      new Promise<{ key: string; durationSec?: number }>((resolve) => {
        const key = `${item.bookSlug}:${item.storySlug}`;
        const bookMeta = Object.values(books).find((b) => b.slug === item.bookSlug);
        const storyMeta = bookMeta?.stories.find((s) => s.slug === item.storySlug);
        const rawSrc = storyMeta?.audio;
        if (!rawSrc || typeof rawSrc !== "string") {
          resolve({ key });
          return;
        }

        const src = rawSrc.startsWith("http")
          ? rawSrc
          : `https://cdn.sanity.io/files/9u7ilulp/production/${rawSrc}.mp3`;

        const audio = new Audio();
        audio.preload = "metadata";

        const done = (durationSec?: number) => {
          audio.removeAttribute("src");
          audio.load();
          resolve({ key, durationSec });
        };

        const timeout = window.setTimeout(() => done(undefined), 6000);

        audio.onloadedmetadata = () => {
          window.clearTimeout(timeout);
          const duration =
            Number.isFinite(audio.duration) && audio.duration > 0
              ? Math.round(audio.duration)
              : undefined;
          done(duration);
        };
        audio.onerror = () => {
          window.clearTimeout(timeout);
          done(undefined);
        };

        audio.src = src;
      });

    Promise.all(unresolved.map(loadDuration)).then((resolved) => {
      if (cancelled) return;
      if (resolved.length === 0) return;

      setContinueListening((prev) => {
        const next = prev.map((item) => {
          const key = `${item.bookSlug}:${item.storySlug}`;
          const found = resolved.find((r) => r.key === key);
          if (!found || !found.durationSec) return item;
          return { ...item, audioDurationSec: found.durationSec };
        });

        try {
          localStorage.setItem("dp_continue_listening_v1", JSON.stringify(next));
        } catch {
          // silencioso
        }

        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [continueListening]);

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

  const withReturnContext = (href: string) => {
    const [base, existingQuery = ""] = href.split("?");
    const params = new URLSearchParams(existingQuery);
    params.set("returnTo", "/");
    params.set("returnLabel", "Home");
    params.set("from", "home");
    return `${base}?${params.toString()}`;
  };

  const continueDesktopCardWidthClass =
    continueListening.length === 1
      ? "w-[420px] lg:w-[460px]"
      : continueListening.length === 2
        ? "w-[360px] lg:w-[400px]"
        : "w-[320px] lg:w-[340px]";

  const renderContinueCard = (item: ContinueItem) => (
    <Link
      key={`${item.bookSlug}:${item.storySlug}`}
      href={withReturnContext(`/books/${item.bookSlug}/${item.storySlug}`)}
      className="flex flex-col bg-white/5 hover:bg-white/10 transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
    >
      <div className="w-full h-48 bg-gray-800">
        <img
          src={item.cover}
          alt={item.title}
          className="object-cover w-full h-full"
        />
      </div>

      <div className="p-5 flex flex-col justify-between flex-1 text-left">
        <div>
          <h3 className="text-xl font-semibold mb-2 text-white line-clamp-2">
            {item.title}
          </h3>
          <p className="text-sky-300 text-sm leading-relaxed line-clamp-1">
            {item.bookTitle}
          </p>
        </div>

        <div className="mt-3 text-sm text-gray-400 space-y-1">
          <p>
            {capitalize(item.language)} · {capitalize(item.level)}
          </p>
          <p>
            {formatAudioDuration(item.audioDurationSec)} · {capitalizeWords(item.topic)}
          </p>
        </div>
      </div>
    </Link>
  );

  return (
    <div className="min-h-full w-full text-white flex flex-col items-center px-8 pb-28">
      {/* Continue listening */}
      {continueListening.length > 0 && (
        <section className="w-full max-w-5xl text-center pt-10 mb-12">
          <h2 className="text-2xl font-semibold mb-6">Continue listening</h2>

          <div className="md:hidden min-h-[240px]">
            <StoryCarousel
              items={continueListening}
              centerMobile
              renderItem={(item) => renderContinueCard(item)}
            />
          </div>

          <div className="hidden md:block">
            {continueListening.length <= 3 ? (
              <div className="flex justify-center gap-4">
                {continueListening.map((item) => (
                  <div
                    key={`${item.bookSlug}:${item.storySlug}`}
                    className={continueDesktopCardWidthClass}
                  >
                    {renderContinueCard(item)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="min-h-[240px]">
                <StoryCarousel
                  items={continueListening}
                  renderItem={(item) => renderContinueCard(item)}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Latest Books */}
      <section className="mb-12 text-center w-full max-w-5xl">
        <h2 className="text-2xl font-semibold mb-6 text-white">Latest Books</h2>

        <div className="grid md:hidden gap-8 grid-cols-1 sm:grid-cols-2 place-items-center">
          {filteredBooks.slice(0, MOBILE_LIMIT).map((book) => (
            <Link
              key={book.slug}
              href={`/books/${book.slug}?from=home`}
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
            </Link>
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
                href={`/books/${book.slug}?from=home`}
              />
            )}
          />
        </div>
      </section>

      {/* Latest Stories (mismas dimensiones que Explore) */}
      <section className="mb-12 text-center w-full max-w-5xl">
        <h2 className="text-2xl font-semibold mb-6 text-white">Latest Stories</h2>

        <div className="min-h-[240px]">
          <StoryCarousel
            items={storiesForHome}
            renderItem={(s) => (
              <Link
                key={`${s.bookSlug}:${s.storySlug}`}
                href={withReturnContext(`/books/${s.bookSlug}/${s.storySlug}`)}
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
              </Link>
            )}
          />
        </div>

        <div className="md:hidden mt-4 text-white/60 text-sm">
          Showing {Math.min(MOBILE_LIMIT, storiesForHome.length)} of {storiesForHome.length}
        </div>
      </section>

      {/* Latest Polyglot Stories (mismas dimensiones que Explore) */}
      <section className="mb-12 text-center w-full max-w-5xl">
        <h2 className="text-2xl font-semibold mb-6 text-white">Latest Polyglot Stories</h2>

        <div className="min-h-[320px]">
          <StoryCarousel
            items={polyglotForHome}
            renderItem={(story) => (
              <Link
                key={story.slug}
                href={withReturnContext(`/stories/${story.slug}`)}
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
              </Link>
            )}
          />
        </div>
      </section>

    </div>
  );
}
