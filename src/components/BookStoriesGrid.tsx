"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type Book, type Story } from "@/types/books";
import { formatTopic } from "@/lib/displayFormat";
import LevelBadge from "@/components/LevelBadge";
import LanguageBadge from "@/components/LanguageBadge";
import RegionBadge from "@/components/RegionBadge";

type ContinueLocalItem = {
  bookSlug: string;
  storySlug: string;
  progressSec?: number;
  audioDurationSec?: number;
};

type ReadingHistoryItem = {
  storyId: string;
  date?: string;
};

type StoryStatus = "start" | "continue" | "completed";

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function estimateReadMinutes(text: string): number {
  const words = stripHtml(text).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

function truncate(input: string, max = 90): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max).trimEnd()}...`;
}

function isContinueLocalItem(x: unknown): x is ContinueLocalItem {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return typeof r.bookSlug === "string" && typeof r.storySlug === "string";
}

function isReadingHistoryItem(x: unknown): x is ReadingHistoryItem {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return typeof r.storyId === "string";
}

type Props = {
  book: Book;
  stories: Story[];
  hrefSuffix?: string;
  replaceNavigation?: boolean;
  dense?: boolean;
};

export default function BookStoriesGrid({
  book,
  stories,
  hrefSuffix = "",
  replaceNavigation = false,
  dense = false,
}: Props) {
  const [continueMap, setContinueMap] = useState<Map<string, ContinueLocalItem>>(new Map());
  const [readingSet, setReadingSet] = useState<Set<string>>(new Set());
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px)").matches;
  });
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    slidesToScroll: 1,
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useLayoutEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mql.matches);
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    const loadState = () => {
      try {
        const rawContinue = localStorage.getItem("dp_continue_listening_v1");
        const parsedContinue: unknown = rawContinue ? JSON.parse(rawContinue) : [];
        const continueItems = Array.isArray(parsedContinue)
          ? parsedContinue.filter(isContinueLocalItem)
          : [];
        const nextContinueMap = new Map<string, ContinueLocalItem>();
        continueItems.forEach((item) => {
          nextContinueMap.set(`${item.bookSlug}:${item.storySlug}`, item);
        });
        setContinueMap(nextContinueMap);
      } catch {
        setContinueMap(new Map());
      }

      try {
        const rawHistory = localStorage.getItem("dp_reading_history_v1");
        const parsedHistory: unknown = rawHistory ? JSON.parse(rawHistory) : [];
        const historyItems = Array.isArray(parsedHistory)
          ? parsedHistory.filter(isReadingHistoryItem)
          : [];
        setReadingSet(new Set(historyItems.map((item) => item.storyId)));
      } catch {
        setReadingSet(new Set());
      }
    };

    loadState();

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "dp_continue_listening_v1" || e.key === "dp_reading_history_v1") {
        loadState();
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("continue-listening-updated", loadState);
    window.addEventListener("focus", loadState);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("continue-listening-updated", loadState);
      window.removeEventListener("focus", loadState);
    };
  }, []);

  const statusMap = useMemo(() => {
    const map = new Map<string, StoryStatus>();

    stories.forEach((story) => {
      const key = `${book.slug}:${story.slug}`;
      const local = continueMap.get(key);
      const fromHistory = readingSet.has(story.id);
      const progress =
        typeof local?.progressSec === "number" && Number.isFinite(local.progressSec)
          ? local.progressSec
          : 0;
      const duration =
        typeof local?.audioDurationSec === "number" && Number.isFinite(local.audioDurationSec)
          ? local.audioDurationSec
          : 0;

      const completedFromAudio = duration > 0 && progress >= duration * 0.95;
      if (completedFromAudio || fromHistory) {
        map.set(story.id, "completed");
      } else if (progress > 5) {
        map.set(story.id, "continue");
      } else {
        map.set(story.id, "start");
      }
    });

    return map;
  }, [book.slug, continueMap, readingSet, stories]);

  const updateButtons = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || !isDesktop) return;
    updateButtons();
    emblaApi.on("select", updateButtons);
    emblaApi.on("reInit", updateButtons);
    return () => {
      emblaApi.off("select", updateButtons);
      emblaApi.off("reInit", updateButtons);
    };
  }, [emblaApi, isDesktop, updateButtons]);

  useEffect(() => {
    if (!emblaApi || !isDesktop) return;
    emblaApi.reInit();
    updateButtons();
  }, [emblaApi, isDesktop, stories.length, updateButtons]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const renderStoryCard = (story: Story, idx: number) => {
    const storyCover =
      typeof story.cover === "string" && story.cover.trim() !== ""
        ? story.cover
        : typeof book.cover === "string" && book.cover.trim() !== ""
          ? book.cover
          : "/covers/default.jpg";

    const storyLanguage = story.language ?? book.language;
    const storyRegion = story.region ?? book.region;
    const storyLevel = story.level ?? book.level;
    const storyTopic = story.topic ?? book.topic;
    const readMinutes = estimateReadMinutes(story.text ?? "");
    const excerpt = truncate(stripHtml(story.text ?? ""));
    const status = statusMap.get(story.id) ?? "start";

    return (
      <Link
        key={story.id}
        href={`/books/${book.slug}/${story.slug}${hrefSuffix}`}
        replace={replaceNavigation}
        className="flex h-full flex-col overflow-hidden rounded-xl bg-white/5 text-gray-100 transition-colors hover:bg-white/10"
      >
        <div className="relative w-full aspect-[16/10] bg-[#102746]">
          <img
            src={storyCover}
            alt={story.title}
            className={`h-full w-full object-cover ${status === "completed" ? "opacity-85" : ""}`}
          />

          <span className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium text-white">
            Story {idx + 1}
          </span>

          {status === "completed" && (
            <span className="absolute right-2 top-2 rounded-md bg-emerald-500/90 px-2 py-1 text-[11px] font-semibold text-white">
              Completed
            </span>
          )}

          {status === "continue" && (
            <span className="absolute right-2 top-2 rounded-md bg-sky-500/90 px-2 py-1 text-[11px] font-semibold text-white">
              Continue
            </span>
          )}
        </div>

        <div className={dense ? "p-2.5" : "p-3"}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <LevelBadge level={storyLevel} />
            <LanguageBadge language={storyLanguage} />
            <RegionBadge region={storyRegion} />
          </div>
          <h3 className={dense ? "line-clamp-2 text-[15px] font-semibold leading-snug" : "line-clamp-2 text-base font-semibold leading-snug"}>
            {story.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs text-gray-400">{excerpt}</p>

          <p className="mt-1 text-xs text-gray-400">
            {readMinutes} min read · {formatTopic(storyTopic)}
          </p>

          <p className="mt-2 text-xs font-medium text-sky-300">
            {status === "completed" ? "Read again" : status === "continue" ? "Continue" : "Start"}
          </p>
        </div>
      </Link>
    );
  };

  if (!isDesktop) {
    return (
      <div className="relative w-full">
        <div
          className="hide-scrollbar flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {stories.map((story, idx) => (
            <div key={story.id} className="w-[82%] flex-shrink-0 snap-start sm:w-[58%]">
              {renderStoryCard(story, idx)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-3">
      <button
        type="button"
        onClick={scrollPrev}
        disabled={!canScrollPrev}
        className={`hidden flex-shrink-0 rounded-full bg-[#1B2347] p-2 shadow-lg transition-opacity md:flex ${
          canScrollPrev ? "opacity-100" : "cursor-default opacity-40"
        }`}
      >
        <ChevronLeft className="h-5 w-5 text-white" />
      </button>

      <div className="w-full overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4 will-change-transform">
          {stories.map((story, idx) => (
            <div key={story.id} className="min-w-0 flex-shrink-0 basis-[31%]">
              {renderStoryCard(story, idx)}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={scrollNext}
        disabled={!canScrollNext}
        className={`hidden flex-shrink-0 rounded-full bg-[#1B2347] p-2 shadow-lg transition-opacity md:flex ${
          canScrollNext ? "opacity-100" : "cursor-default opacity-40"
        }`}
      >
        <ChevronRight className="h-5 w-5 text-white" />
      </button>
    </div>
  );
}
