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
import { useMemo } from "react";
import ExploreSearch from "@/components/ExploreSearch";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatLanguage, formatRegion, formatTopic } from "@domain/displayFormat";
import { getBookCardMeta } from "@domain/bookCardMeta";
import { ChevronDown } from "lucide-react";
import {
  pickOnboardingTopicPreference,
  scoreReadTimeFit,
  scoreTopicLabelAgainstOnboarding,
  type OnboardingGoal,
} from "@/lib/onboarding";
import { resolvePublicMediaUrl } from "@/lib/publicMedia";

type UserStory = {
  id: string;
  slug: string;
  title: string;
  language: string;
  region?: string;
  level: string;
  topic?: string;
  themes?: string[];
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
  const v = resolvePublicMediaUrl(raw) ?? "";
  if (!v) return "/covers/default.jpg";

  return v;
}

function stripHtml(input?: string): string {
  return (input ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
  const regionFromUrl = searchParams.get("region") ?? "";

  const rawTargetLanguages = user?.publicMetadata?.targetLanguages as unknown;
  const targetLanguages = useMemo(() => rawTargetLanguages ?? [], [rawTargetLanguages]);
  const rawInterests = user?.publicMetadata?.interests as unknown;
  const interests = useMemo(() => (isStringArray(rawInterests) ? rawInterests : []), [rawInterests]);
  const learningGoalRaw = user?.publicMetadata?.learningGoal as unknown;
  const learningGoal = typeof learningGoalRaw === "string" ? (learningGoalRaw as OnboardingGoal) : null;
  const dailyMinutesRaw = user?.publicMetadata?.dailyMinutes as unknown;
  const dailyMinutes = typeof dailyMinutesRaw === "number" ? dailyMinutesRaw : null;
  const preferredRegionRaw = user?.publicMetadata?.preferredRegion as unknown;
  const preferredRegion = typeof preferredRegionRaw === "string" ? preferredRegionRaw.trim() : "";
  const normalizedTargetLanguages = useMemo(() => {
    if (!isStringArray(targetLanguages)) return [];
    return targetLanguages
      .map((value) => value.trim())
      .filter(Boolean);
  }, [targetLanguages]);
  const effectiveLanguageValue = languageFromUrl.trim() || normalizedTargetLanguages[0] || "";
  const effectiveRegionValue = regionFromUrl.trim() || preferredRegion;
  const selectedLanguageKey = normalizeTopicKey(effectiveLanguageValue);
  const selectedRegionKey = normalizeTopicKey(effectiveRegionValue);
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
      normalizedTargetLanguages.length > 0
        ? new Set(normalizedTargetLanguages.map((l) => l.toLowerCase()))
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
      value: string | undefined | null,
      formatter?: (value?: string) => string
    ) => {
      const raw = typeof value === "string" ? value.trim() : "";
      const label = raw ? (formatter ? formatter(raw) : raw) : "";
      const key = normalizeTopicKey(label);
      if (!key) return;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }
      map.set(key, { label: formatter ? formatter(label) : label, count: 1 });
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
      addFilterValue(languageMap, getString(book, "language"), formatLanguage);
      addFilterValue(regionMap, getString(book, "region"), formatRegion);
      addTopics(extractBookTopics(book));
    }

    for (const story of languageFilteredBookStories) {
      addFilterValue(languageMap, story.language, formatLanguage);
      addFilterValue(regionMap, story.region, formatRegion);
      addTopics(story.topics);
    }

    for (const story of languageFilteredPolyglotStories) {
      addFilterValue(languageMap, story.language, formatLanguage);
      addFilterValue(regionMap, story.region, formatRegion);
      addTopics([...toTopicList(story.topic), ...toTopicList(story.themes)]);
    }

    const languageOptions: FilterChip[] = Array.from(languageMap.entries())
      .map(([key, value]) => ({ key, label: value.label, count: value.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const languageSelectedLabel =
      languageOptions.find((chip) => chip.key === selectedLanguageKey)?.label ||
      (effectiveLanguageValue || null);

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
      addFilterValue(regionMapAfterLanguage, getString(book, "region"), formatRegion);
    }
    for (const story of languageSelectedBookStories) addFilterValue(regionMapAfterLanguage, story.region, formatRegion);
    for (const story of languageSelectedPolyglotStories) addFilterValue(regionMapAfterLanguage, story.region, formatRegion);

    const regionOptions: FilterChip[] = Array.from(regionMapAfterLanguage.entries())
      .map(([key, value]) => ({ key, label: value.label, count: value.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const regionSelectedLabel =
      regionOptions.find((chip) => chip.key === selectedRegionKey)?.label ||
      effectiveRegionValue ||
      null;

    const chips: TopicChip[] = Array.from(topicMap.entries())
      .map(([key, value]) => ({
        key,
        label: value.label,
        count: value.count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const defaultTopicLabel = topicFromUrl.trim()
      ? null
      : pickOnboardingTopicPreference(
          chips.map((chip) => chip.label),
          interests,
          learningGoal
        );
    const effectiveTopicKey = selectedTopicKey || normalizeTopicKey(defaultTopicLabel ?? "");
    const selectedLabel =
      chips.find((chip) => chip.key === effectiveTopicKey)?.label ||
      defaultTopicLabel ||
      topicFromUrl.trim() ||
      null;

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

    const topicFilteredBooks = effectiveTopicKey
      ? regionFilteredBooks.filter((book) => {
          if (!isRecord(book)) return false;
          return matchesTopic(extractBookTopics(book), effectiveTopicKey);
        })
      : regionFilteredBooks;

    const topicFilteredBookStories = effectiveTopicKey
      ? regionFilteredBookStories.filter((story) => matchesTopic(story.topics, effectiveTopicKey))
      : regionFilteredBookStories;

    const topicFilteredPolyglotStories = effectiveTopicKey
      ? regionFilteredPolyglotStories.filter((story) =>
          matchesTopic([...toTopicList(story.topic), ...toTopicList(story.themes)], effectiveTopicKey)
        )
      : regionFilteredPolyglotStories;

    const rankedBooks = [...topicFilteredBooks].sort((a, b) => {
      const scoreBook = (book: unknown) => {
        if (!isRecord(book)) return 0;
        const slug = getString(book, "slug") ?? "";
        const bookMeta = books[slug as keyof typeof books];
        const avgReadMinutes =
          bookMeta && bookMeta.stories.length > 0
            ? Math.round(bookMeta.stories.reduce((sum, story) => sum + Math.max(1, Math.ceil(stripHtml(story.text ?? "").split(/\s+/).filter(Boolean).length / 180)), 0) / bookMeta.stories.length)
            : null;
        return (
          scoreTopicLabelAgainstOnboarding(
            [getString(book, "topic"), getString(book, "title"), getString(book, "description")].filter(Boolean).join(" "),
            interests,
            learningGoal
          ) +
          scoreReadTimeFit(avgReadMinutes, dailyMinutes)
        );
      };
      return scoreBook(b) - scoreBook(a);
    });

    const rankedBookStories = [...topicFilteredBookStories].sort((a, b) => {
      const scoreStory = (story: BookStoryItem) =>
        scoreTopicLabelAgainstOnboarding(
          [...story.topics, story.storyTitle, story.bookTitle].join(" "),
          interests,
          learningGoal
        ) + scoreReadTimeFit(Math.max(1, Math.ceil((books[story.bookSlug as keyof typeof books]?.stories.find((entry) => entry.slug === story.storySlug)?.text ?? "").split(/\s+/).filter(Boolean).length / 180)), dailyMinutes);
      return scoreStory(b) - scoreStory(a) || a.storyTitle.localeCompare(b.storyTitle);
    });

    const rankedPolyglotStories = [...topicFilteredPolyglotStories].sort((a, b) => {
      const scorePolyglot = (story: UserStory) =>
        scoreTopicLabelAgainstOnboarding(
          [story.topic, ...(story.themes ?? []), story.title, story.text].filter(Boolean).join(" "),
          interests,
          learningGoal
        ) + scoreReadTimeFit(Math.max(1, Math.ceil(stripHtml(story.text ?? "").split(/\s+/).filter(Boolean).length / 180)), dailyMinutes);
      return scorePolyglot(b) - scorePolyglot(a) || a.title.localeCompare(b.title);
    });

    const preview = rankedBookStories.slice(0, 18);

    return {
      filteredBooks: rankedBooks,
      filteredPolyglotStories: rankedPolyglotStories,
      allFilteredBookStories: rankedBookStories,
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
    normalizedTargetLanguages,
    selectedLanguageKey,
    selectedRegionKey,
    selectedTopicKey,
    effectiveLanguageValue,
    effectiveRegionValue,
    interests,
    learningGoal,
    dailyMinutes,
    topicFromUrl,
  ]);

  const topicRows = useMemo(() => {
    const rows: TopicChip[][] = [[], [], []];
    topicChips.forEach((chip, index) => {
      rows[index % 3].push(chip);
    });
    return rows;
  }, [topicChips]);


  const safeBooks = Array.isArray(filteredBooks) ? filteredBooks : [];
  const safePolyglotStories = Array.isArray(filteredPolyglotStories) ? filteredPolyglotStories : [];
  const safePreviewBookStories = Array.isArray(previewBookStories) ? previewBookStories : [];
  const safeAllFilteredBookStories = Array.isArray(allFilteredBookStories)
    ? allFilteredBookStories
    : [];

  const hasAnyFilteredContent =
    safeBooks.length > 0 || safePreviewBookStories.length > 0 || safePolyglotStories.length > 0;

  const currentExplorePath = (() => {
    const q = searchParams.toString();
    return q ? `${pathname}?${q}` : pathname;
  })();
  const seeAllStoriesHref = (() => {
    const params = new URLSearchParams();
    if (effectiveLanguageValue) params.set("language", effectiveLanguageValue);
    if (effectiveRegionValue) params.set("region", effectiveRegionValue);
    if (topicFromUrl.trim()) {
      params.set("topic", topicFromUrl.trim());
    }
    const q = params.toString();
    return q ? `/explore/stories?${q}` : "/explore/stories";
  })();
  const seeAllBooksHref = (() => {
    const params = new URLSearchParams();
    if (effectiveLanguageValue) params.set("language", effectiveLanguageValue);
    if (effectiveRegionValue) params.set("region", effectiveRegionValue);
    if (topicFromUrl.trim()) {
      params.set("topic", topicFromUrl.trim());
    }
    const q = params.toString();
    return q ? `/explore/books?${q}` : "/explore/books";
  })();
  const seeAllPolyglotStoriesHref = (() => {
    const params = new URLSearchParams();
    if (effectiveLanguageValue) params.set("language", effectiveLanguageValue);
    if (effectiveRegionValue) params.set("region", effectiveRegionValue);
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
            <div className="flex min-w-max items-end gap-2 pr-4 md:gap-3">
              <label className="block min-w-[170px] flex-1 sm:min-w-[190px] md:min-w-[240px]">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Language
                </span>
                <div className="relative">
                  <select
                    value={selectedLanguageLabel ?? ""}
                    onChange={(event) => setFilterInUrl("language", event.target.value)}
                    className="w-full appearance-none rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)] px-3 pr-11 py-2 text-[13px] font-medium text-[var(--foreground)] outline-none transition-colors hover:bg-[var(--card-bg-hover)] focus:border-blue-300/40 md:px-4 md:pr-12 md:py-2.5 md:text-sm"
                  >
                    <option value="">
                      {normalizedTargetLanguages.length > 0 ? "Your languages" : "All languages"}
                    </option>
                    {languageChips.map((chip) => (
                      <option key={chip.key} value={chip.label}>
                        {chip.label} ({chip.count})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)] md:right-4" />
                </div>
              </label>

              <label className="block min-w-[160px] flex-1 sm:min-w-[180px] md:min-w-[220px]">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Region
                </span>
                <div className="relative">
                  <select
                    value={selectedRegionLabel ?? ""}
                    onChange={(event) => setFilterInUrl("region", event.target.value)}
                    className="w-full appearance-none rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)] px-3 pr-11 py-2 text-[13px] font-medium text-[var(--foreground)] outline-none transition-colors hover:bg-[var(--card-bg-hover)] focus:border-blue-300/40 md:px-4 md:pr-12 md:py-2.5 md:text-sm"
                  >
                    <option value="">All regions</option>
                    {regionChips.map((chip) => (
                      <option key={chip.key} value={chip.label}>
                        {chip.label} ({chip.count})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)] md:right-4" />
                </div>
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
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Individual Stories</h2>
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
                  : "No individual stories have been published yet."}
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
