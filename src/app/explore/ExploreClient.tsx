"use client";

import Link from "next/link";
import { books } from "@/data/books";
import StoryCarousel from "@/components/StoryCarousel";
import ReleaseCarousel from "@/components/ReleaseCarousel";
import BookHorizontalCard from "@/components/BookHorizontalCard";
import LevelBadge from "@/components/LevelBadge";
import LanguageBadge from "@/components/LanguageBadge";
import RegionBadge from "@/components/RegionBadge";
import { useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import ExploreSearch from "@/components/ExploreSearch";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatTopic } from "@/lib/displayFormat";
import { getBookCardMeta } from "@/lib/bookCardMeta";

const formatAudioDuration = (totalSeconds?: number) => {
  if (!totalSeconds || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return "--:--";
  const rounded = Math.floor(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

type UserStory = {
  id: string;
  slug: string;
  title: string;
  language: string;
  region?: string;
  level: string;
  topic?: string;
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
  region?: string;
  level: string;
  coverUrl: string;
  topics: string[];
};

type TopicChip = {
  key: string;
  label: string;
  count: number;
};

type FilterChip = {
  key: string;
  label: string;
  count: number;
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

function normalizeTopicKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toTopicList(value: unknown): string[] {
  const values: string[] = [];

  if (typeof value === "string") {
    const cleaned = value.trim();
    if (cleaned) values.push(cleaned);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry !== "string") continue;
      const cleaned = entry.trim();
      if (cleaned) values.push(cleaned);
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of values) {
    const key = normalizeTopicKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function extractBookTopics(book: Record<string, unknown>): string[] {
  return toTopicList([
    ...(toTopicList(book["topic"])),
    ...(toTopicList(book["theme"])),
    ...(toTopicList(book["tags"])),
  ]);
}

function extractBookStories(allBooksUnknown: unknown[]): BookStoryItem[] {
  const out: BookStoryItem[] = [];

  for (const b of allBooksUnknown) {
    if (!isRecord(b)) continue;

    const bookSlug = getString(b, "slug");
    const bookTitle = getString(b, "title") ?? "";
    const language = getString(b, "language") ?? "";
    const region = getString(b, "region") ?? "";
    const level = getString(b, "level") ?? "";
    const bookCover = normalizeCoverUrl(getString(b, "cover"));
    const bookTopics = extractBookTopics(b);

    if (!bookSlug) continue;

    const pushStory = (story: unknown, index: number) => {
      if (!isRecord(story)) return;

      const storySlug = getString(story, "slug");
      const storyTitle = getString(story, "title") ?? "";
      const storyLanguage = getString(story, "language") ?? language;
      const storyRegion = getString(story, "region") ?? region;
      const storyLevel = getString(story, "level") ?? level;
      const storyCover = normalizeCoverUrl(getString(story, "cover"));
      const coverUrl = storyCover !== "/covers/default.jpg" ? storyCover : bookCover;
      const storyTopics = toTopicList([
        ...(toTopicList(story["topic"])),
        ...(toTopicList(story["theme"])),
        ...(toTopicList(story["tags"])),
      ]);
      const topics = toTopicList([...storyTopics, ...bookTopics]);

      if (!storySlug) return;

      out.push({
        id: `${bookSlug}:${storySlug}:${index}`,
        bookSlug,
        bookTitle,
        storySlug,
        storyTitle,
        language: storyLanguage,
        region: storyRegion || undefined,
        level: storyLevel,
        coverUrl,
        topics,
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

function matchesTopic(topics: string[], topicKey: string): boolean {
  if (!topicKey) return true;
  return topics.some((topic) => normalizeTopicKey(topic) === topicKey);
}

export default function ExploreClient({ polyglotStories }: ExploreClientProps) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const topicFromUrl = searchParams.get("topic") ?? "";
  const selectedTopicKey = normalizeTopicKey(topicFromUrl);
  const languageFromUrl = searchParams.get("language") ?? "";
  const selectedLanguageKey = normalizeTopicKey(languageFromUrl);
  const regionFromUrl = searchParams.get("region") ?? "";
  const selectedRegionKey = normalizeTopicKey(regionFromUrl);

  const rawTargetLanguages = user?.publicMetadata?.targetLanguages as unknown;
  const targetLanguages = useMemo(() => rawTargetLanguages ?? [], [rawTargetLanguages]);
  const bookMetaBySlug = useMemo(() => {
    const map = new Map<string, { statsLine?: string; topicsLine?: string }>();
    for (const book of Object.values(books)) {
      map.set(book.slug, getBookCardMeta(book));
    }
    return map;
  }, []);

  const {
    filteredBooks,
    filteredPolyglotStories,
    allFilteredBookStories,
    previewBookStories,
    languageChips,
    regionChips,
    selectedLanguageLabel,
    selectedRegionLabel,
    topicChips,
    selectedTopicLabel,
  } = useMemo(() => {
    const allBooks = Object.values(books) as unknown[];
    const allBookStories = extractBookStories(allBooks);

    const langs =
      isStringArray(targetLanguages) && targetLanguages.length > 0
        ? new Set(targetLanguages.map((l) => l.toLowerCase()))
        : null;

    const languageFilteredBooks = langs
      ? allBooks.filter((book) => {
          if (!isRecord(book)) return false;
          const lang = getString(book, "language");
          return typeof lang === "string" && langs.has(lang.toLowerCase());
        })
      : allBooks;

    const languageFilteredPolyglotStories = langs
      ? polyglotStories.filter(
          (s) => typeof s.language === "string" && langs.has(s.language.toLowerCase())
        )
      : polyglotStories;

    const languageFilteredBookStories = langs
      ? allBookStories.filter(
          (s) => typeof s.language === "string" && langs.has(s.language.toLowerCase())
        )
      : allBookStories;

    const languageMap = new Map<string, { label: string; count: number }>();
    const regionMap = new Map<string, { label: string; count: number }>();
    const topicMap = new Map<string, { label: string; count: number }>();

    const addFilterValue = (
      map: Map<string, { label: string; count: number }>,
      value: string | undefined | null
    ) => {
      const label = typeof value === "string" ? value.trim() : "";
      const key = normalizeTopicKey(label);
      if (!key) return;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }
      map.set(key, { label, count: 1 });
    };

    const addTopics = (topics: string[]) => {
      const local = new Set<string>();
      for (const topic of topics) {
        const key = normalizeTopicKey(topic);
        if (!key || local.has(key)) continue;
        local.add(key);

        const existing = topicMap.get(key);
        if (existing) {
          existing.count += 1;
          continue;
        }

        topicMap.set(key, { label: topic.trim(), count: 1 });
      }
    };

    for (const book of languageFilteredBooks) {
      if (!isRecord(book)) continue;
      addFilterValue(languageMap, getString(book, "language"));
      addFilterValue(regionMap, getString(book, "region"));
      addTopics(extractBookTopics(book));
    }

    for (const story of languageFilteredBookStories) {
      addFilterValue(languageMap, story.language);
      addFilterValue(regionMap, story.region);
      addTopics(story.topics);
    }

    for (const story of languageFilteredPolyglotStories) {
      addFilterValue(languageMap, story.language);
      addFilterValue(regionMap, story.region);
      addTopics(toTopicList(story.topic));
    }

    const languageOptions: FilterChip[] = Array.from(languageMap.entries())
      .map(([key, value]) => ({ key, label: value.label, count: value.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const languageSelectedLabel =
      languageOptions.find((chip) => chip.key === selectedLanguageKey)?.label ||
      languageFromUrl.trim() ||
      null;

    const languageSelectedBooks = selectedLanguageKey
      ? languageFilteredBooks.filter((book) => {
          if (!isRecord(book)) return false;
          return normalizeTopicKey(getString(book, "language") ?? "") === selectedLanguageKey;
        })
      : languageFilteredBooks;

    const languageSelectedBookStories = selectedLanguageKey
      ? languageFilteredBookStories.filter(
          (story) => normalizeTopicKey(story.language ?? "") === selectedLanguageKey
        )
      : languageFilteredBookStories;

    const languageSelectedPolyglotStories = selectedLanguageKey
      ? languageFilteredPolyglotStories.filter(
          (story) => normalizeTopicKey(story.language ?? "") === selectedLanguageKey
        )
      : languageFilteredPolyglotStories;

    const regionMapAfterLanguage = new Map<string, { label: string; count: number }>();
    for (const book of languageSelectedBooks) {
      if (!isRecord(book)) continue;
      addFilterValue(regionMapAfterLanguage, getString(book, "region"));
    }
    for (const story of languageSelectedBookStories) addFilterValue(regionMapAfterLanguage, story.region);
    for (const story of languageSelectedPolyglotStories) addFilterValue(regionMapAfterLanguage, story.region);

    const regionOptions: FilterChip[] = Array.from(regionMapAfterLanguage.entries())
      .map(([key, value]) => ({ key, label: value.label, count: value.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const regionSelectedLabel =
      regionOptions.find((chip) => chip.key === selectedRegionKey)?.label ||
      regionFromUrl.trim() ||
      null;

    const chips: TopicChip[] = Array.from(topicMap.entries())
      .map(([key, value]) => ({
        key,
        label: value.label,
        count: value.count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const selectedLabel =
      chips.find((chip) => chip.key === selectedTopicKey)?.label || topicFromUrl.trim() || null;

    const regionFilteredBooks = selectedRegionKey
      ? languageSelectedBooks.filter((book) => {
          if (!isRecord(book)) return false;
          return normalizeTopicKey(getString(book, "region") ?? "") === selectedRegionKey;
        })
      : languageSelectedBooks;

    const regionFilteredBookStories = selectedRegionKey
      ? languageSelectedBookStories.filter(
          (story) => normalizeTopicKey(story.region ?? "") === selectedRegionKey
        )
      : languageSelectedBookStories;

    const regionFilteredPolyglotStories = selectedRegionKey
      ? languageSelectedPolyglotStories.filter(
          (story) => normalizeTopicKey(story.region ?? "") === selectedRegionKey
        )
      : languageSelectedPolyglotStories;

    const topicFilteredBooks = selectedTopicKey
      ? regionFilteredBooks.filter((book) => {
          if (!isRecord(book)) return false;
          return matchesTopic(extractBookTopics(book), selectedTopicKey);
        })
      : regionFilteredBooks;

    const topicFilteredBookStories = selectedTopicKey
      ? regionFilteredBookStories.filter((story) => matchesTopic(story.topics, selectedTopicKey))
      : regionFilteredBookStories;

    const topicFilteredPolyglotStories = selectedTopicKey
      ? regionFilteredPolyglotStories.filter((story) =>
          matchesTopic(toTopicList(story.topic), selectedTopicKey)
        )
      : regionFilteredPolyglotStories;

    const preview = topicFilteredBookStories.slice(0, 18);

    return {
      filteredBooks: topicFilteredBooks,
      filteredPolyglotStories: topicFilteredPolyglotStories,
      allFilteredBookStories: topicFilteredBookStories,
      previewBookStories: preview,
      languageChips: languageOptions,
      regionChips: regionOptions,
      selectedLanguageLabel: languageSelectedLabel,
      selectedRegionLabel: regionSelectedLabel,
      topicChips: chips,
      selectedTopicLabel: selectedLabel,
    };
  }, [
    polyglotStories,
    targetLanguages,
    selectedLanguageKey,
    selectedRegionKey,
    selectedTopicKey,
    languageFromUrl,
    regionFromUrl,
    topicFromUrl,
  ]);

  const topicRows = useMemo(() => {
    const rows: TopicChip[][] = [[], [], []];
    topicChips.forEach((chip, index) => {
      rows[index % 3].push(chip);
    });
    return rows;
  }, [topicChips]);

  const [storyDurations, setStoryDurations] = useState<Record<string, number>>({});

  const safeBooks = Array.isArray(filteredBooks) ? filteredBooks : [];
  const safePolyglotStories = Array.isArray(filteredPolyglotStories) ? filteredPolyglotStories : [];
  const safePreviewBookStories = Array.isArray(previewBookStories) ? previewBookStories : [];
  const safeAllFilteredBookStories = Array.isArray(allFilteredBookStories)
    ? allFilteredBookStories
    : [];

  useEffect(() => {
    if (safePreviewBookStories.length === 0) return;

    const unresolved = safePreviewBookStories.filter((story) => {
      const key = `${story.bookSlug}:${story.storySlug}`;
      const bookMeta = Object.values(books).find((b) => b.slug === story.bookSlug);
      const storyMeta = bookMeta?.stories.find((s) => s.slug === story.storySlug);
      const hasAudio = typeof storyMeta?.audio === "string" && storyMeta.audio.trim() !== "";
      return !(typeof storyDurations[key] === "number" && storyDurations[key] > 0) && hasAudio;
    });
    if (unresolved.length === 0) return;

    let cancelled = false;

    const loadDuration = (story: BookStoryItem) =>
      new Promise<{ key: string; durationSec?: number }>((resolve) => {
        const key = `${story.bookSlug}:${story.storySlug}`;
        const bookMeta = Object.values(books).find((b) => b.slug === story.bookSlug);
        const storyMeta = bookMeta?.stories.find((s) => s.slug === story.storySlug);
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
      if (cancelled || resolved.length === 0) return;
      setStoryDurations((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const result of resolved) {
          if (result.durationSec && result.durationSec > 0 && next[result.key] !== result.durationSec) {
            next[result.key] = result.durationSec;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [safePreviewBookStories, storyDurations]);

  const hasAnyFilteredContent =
    safeBooks.length > 0 || safePreviewBookStories.length > 0 || safePolyglotStories.length > 0;

  const currentExplorePath = (() => {
    const q = searchParams.toString();
    return q ? `${pathname}?${q}` : pathname;
  })();
  const seeAllStoriesHref = (() => {
    const params = new URLSearchParams();
    if (languageFromUrl.trim()) params.set("language", languageFromUrl.trim());
    if (regionFromUrl.trim()) params.set("region", regionFromUrl.trim());
    if (topicFromUrl.trim()) {
      params.set("topic", topicFromUrl.trim());
    }
    const q = params.toString();
    return q ? `/explore/stories?${q}` : "/explore/stories";
  })();
  const seeAllBooksHref = (() => {
    const params = new URLSearchParams();
    if (languageFromUrl.trim()) params.set("language", languageFromUrl.trim());
    if (regionFromUrl.trim()) params.set("region", regionFromUrl.trim());
    if (topicFromUrl.trim()) {
      params.set("topic", topicFromUrl.trim());
    }
    const q = params.toString();
    return q ? `/explore/books?${q}` : "/explore/books";
  })();
  const seeAllPolyglotStoriesHref = (() => {
    const params = new URLSearchParams();
    if (languageFromUrl.trim()) params.set("language", languageFromUrl.trim());
    if (regionFromUrl.trim()) params.set("region", regionFromUrl.trim());
    if (topicFromUrl.trim()) {
      params.set("topic", topicFromUrl.trim());
    }
    const q = params.toString();
    return q ? `/explore/polyglot-stories?${q}` : "/explore/polyglot-stories";
  })();

  const withReturnContext = (href: string) => {
    const [base, existingQuery = ""] = href.split("?");
    const params = new URLSearchParams(existingQuery);
    params.set("returnTo", currentExplorePath);
    params.set("returnLabel", "Explore");
    return `${base}?${params.toString()}`;
  };

  const setFilterInUrl = (name: "language" | "region" | "topic", value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }

    if (name === "language" && !value) {
      params.delete("region");
    }

    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  return (
    <div className="-mx-4">
      <div className="max-w-6xl mx-auto p-8 text-[var(--foreground)]">
        <h1 className="text-3xl font-bold mb-6">Explore</h1>

        <ExploreSearch
          className="mb-5"
          books={safeBooks}
          bookStories={safeAllFilteredBookStories}
          polyglotStories={safePolyglotStories}
          returnTo={currentExplorePath}
          returnLabel="Explore"
        />

        <div className="mb-10">
          <div className="mb-5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max items-end gap-3 pr-4">
              <label className="block min-w-[240px] flex-1">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Language
                </span>
                <select
                  value={selectedLanguageLabel ?? ""}
                  onChange={(event) => setFilterInUrl("language", event.target.value)}
                  className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] outline-none transition-colors hover:bg-[var(--card-bg-hover)] focus:border-blue-300/40"
                >
                  <option value="">All languages</option>
                  {languageChips.map((chip) => (
                    <option key={chip.key} value={chip.label}>
                      {chip.label} ({chip.count})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block min-w-[220px] flex-1">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Region
                </span>
                <select
                  value={selectedRegionLabel ?? ""}
                  onChange={(event) => setFilterInUrl("region", event.target.value)}
                  className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] outline-none transition-colors hover:bg-[var(--card-bg-hover)] focus:border-blue-300/40"
                >
                  <option value="">All regions</option>
                  {regionChips.map((chip) => (
                    <option key={chip.key} value={chip.label}>
                      {chip.label} ({chip.count})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="min-w-max space-y-2 pr-4">
              <div className="flex flex-nowrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilterInUrl("topic", "")}
                  className={[
                    "rounded-full border px-3 py-1.5 text-xs transition-colors whitespace-nowrap",
                    !selectedTopicKey
                      ? "border-[var(--chip-border)] bg-[var(--chip-bg)] text-[var(--foreground)]"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--chip-text)] hover:bg-[var(--card-bg-hover)]",
                  ].join(" ")}
                >
                  All topics
                </button>
                {topicRows[0].map((chip) => {
                  const isActive = chip.key === selectedTopicKey;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setFilterInUrl("topic", chip.key)}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs transition-colors whitespace-nowrap",
                        isActive
                          ? "border-[var(--chip-border)] bg-[var(--chip-bg)] text-[var(--foreground)]"
                          : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--chip-text)] hover:bg-[var(--card-bg-hover)]",
                      ].join(" ")}
                    >
                      {chip.label} ({chip.count})
                    </button>
                  );
                })}
              </div>
              {topicRows.slice(1).map((row, rowIndex) => (
                <div key={`topic-row-${rowIndex + 2}`} className="flex flex-nowrap items-center gap-2">
                  {row.map((chip) => {
                    const isActive = chip.key === selectedTopicKey;
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => setFilterInUrl("topic", chip.key)}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs transition-colors whitespace-nowrap",
                          isActive
                            ? "border-[var(--chip-border)] bg-[var(--chip-bg)] text-[var(--foreground)]"
                            : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--chip-text)] hover:bg-[var(--card-bg-hover)]",
                        ].join(" ")}
                      >
                        {chip.label} ({chip.count})
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {(selectedLanguageKey || selectedRegionKey || selectedTopicKey) && !hasAnyFilteredContent ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No content found
              {selectedLanguageKey ? (
                <> in <span className="text-[var(--foreground)]">{selectedLanguageLabel}</span></>
              ) : null}
              {selectedRegionKey ? (
                <> for <span className="text-[var(--foreground)]">{selectedRegionLabel}</span></>
              ) : null}
              {selectedTopicKey ? (
                <> on <span className="text-[var(--foreground)]">{selectedTopicLabel}</span></>
              ) : null}
              .
            </p>
          ) : null}
        </div>

        <div className="mb-10 md:mb-12">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Stories</h2>
            <Link
              href={seeAllStoriesHref}
              className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              See all
            </Link>
          </div>

          {safePreviewBookStories.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-[var(--muted)] bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl">
              {selectedTopicKey
                ? `No stories found for ${selectedTopicLabel ?? "this topic"}.`
                : isStringArray(targetLanguages) && targetLanguages.length > 0
                  ? "No stories found in your selected languages."
                  : "No stories available."}
            </div>
          ) : (
            <div>
              <StoryCarousel
                items={safePreviewBookStories}
                renderItem={(s) => (
                  <Link
                    key={s.id}
                    href={withReturnContext(`/books/${s.bookSlug}/${s.storySlug}`)}
                    className="flex flex-col bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] border border-[var(--card-border)] transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full"
                  >
                    <div className="w-full h-48 bg-[color:var(--surface)]">
                      <img
                        src={s.coverUrl}
                        alt={s.storyTitle}
                        className="object-cover w-full h-full"
                      />
                    </div>

                    <div className="p-5 flex flex-col flex-1 text-left">
                      <div>
                        <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] line-clamp-2">
                          {s.storyTitle || "Untitled story"}
                        </h3>
                        <p className="text-[var(--primary)] text-sm leading-relaxed line-clamp-1">
                          {s.bookTitle || s.bookSlug}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <LevelBadge level={s.level} />
                        <LanguageBadge language={s.language} />
                        <RegionBadge region={s.region} />
                      </div>
                      <p className="text-sm text-[var(--muted)]">
                        {formatAudioDuration(storyDurations[`${s.bookSlug}:${s.storySlug}`])} ·{" "}
                        {formatTopic(s.topics[0])}
                      </p>
                    </div>
                  </Link>
                )}
              />
            </div>
          )}
        </div>

        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Books</h2>
          <Link
            href={seeAllBooksHref}
            className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            See all
          </Link>
        </div>
        {safeBooks.length === 0 ? (
          <p className="text-[var(--muted)]">
            {selectedTopicKey
              ? `No books found for ${selectedTopicLabel ?? "this topic"}.`
              : isStringArray(targetLanguages) && targetLanguages.length > 0
                ? "No books found in your selected languages."
                : "No books available."}
          </p>
        ) : (
          <>
            <div className="md:hidden mb-10 md:mb-12">
              <StoryCarousel
                items={safeBooks}
                mobileItemClassName="w-[82%] sm:w-[62%]"
                renderItem={(bookUnknown) => {
                  if (!isRecord(bookUnknown)) return null;
                  const slug = getString(bookUnknown, "slug") ?? "";
                  const title = getString(bookUnknown, "title") ?? "";
                  const cover = normalizeCoverUrl(getString(bookUnknown, "cover"));
                  const description = getString(bookUnknown, "description") ?? undefined;
                  if (!slug) return null;
                  return (
                    <BookHorizontalCard
                      href={withReturnContext(`/books/${slug}`)}
                      title={title}
                      cover={cover}
                      level={getString(bookUnknown, "level") ?? undefined}
                      language={getString(bookUnknown, "language") ?? undefined}
                      region={getString(bookUnknown, "region") ?? undefined}
                      statsLine={bookMetaBySlug.get(slug)?.statsLine}
                      topicsLine={bookMetaBySlug.get(slug)?.topicsLine}
                      description={description}
                    />
                  );
                }}
              />
            </div>

            <div className="hidden md:block mb-10 md:mb-12">
              <ReleaseCarousel
                items={safeBooks}
                itemClassName="md:flex-[0_0_46%] lg:flex-[0_0_46%] xl:flex-[0_0_46%]"
                renderItem={(bookUnknown) => {
                  if (!isRecord(bookUnknown)) return null;
                  const slug = getString(bookUnknown, "slug") ?? "";
                  const title = getString(bookUnknown, "title") ?? "";
                  const cover = normalizeCoverUrl(getString(bookUnknown, "cover"));
                  const description = getString(bookUnknown, "description") ?? undefined;
                  if (!slug) return null;
                  return (
                    <BookHorizontalCard
                      href={withReturnContext(`/books/${slug}`)}
                      title={title}
                      cover={cover}
                      level={getString(bookUnknown, "level") ?? undefined}
                      language={getString(bookUnknown, "language") ?? undefined}
                      region={getString(bookUnknown, "region") ?? undefined}
                      statsLine={bookMetaBySlug.get(slug)?.statsLine}
                      topicsLine={bookMetaBySlug.get(slug)?.topicsLine}
                      description={description}
                    />
                  );
                }}
              />
            </div>
          </>
        )}

        <div className="mb-10 md:mb-12">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Polyglot Stories</h2>
            <Link
              href={seeAllPolyglotStoriesHref}
              className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              See all
            </Link>
          </div>

          {safePolyglotStories.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center text-[var(--muted)] bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl">
              {selectedTopicKey
                ? `No stories found for ${selectedTopicLabel ?? "this topic"}.`
                : isStringArray(targetLanguages) && targetLanguages.length > 0
                  ? "No stories found in your selected languages."
                  : "No Polyglot stories have been published yet."}
            </div>
          ) : (
            <div>
              <StoryCarousel
                items={safePolyglotStories}
                renderItem={(story) => (
                  <Link
                    key={story.id}
                    href={withReturnContext(`/stories/${story.slug}`)}
                    className="flex flex-col bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] border border-[var(--card-border)] transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full"
                  >
                    <div className="w-full h-48 bg-[color:var(--surface)]">
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

                    <div className="p-5 flex flex-col flex-1 text-left">
                      <div>
                        <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)]">{story.title}</h3>
                        <p className="text-[var(--muted)] text-sm leading-relaxed line-clamp-3">
                          {(story.text ?? "").replace(/<[^>]+>/g, "").slice(0, 120)}...
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <LevelBadge level={story.level} />
                        <LanguageBadge language={story.language} />
                        <RegionBadge region={story.region} />
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
