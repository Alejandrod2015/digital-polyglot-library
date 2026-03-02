"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import StoryCarousel from "@/components/StoryCarousel";
import ReleaseCarousel from "@/components/ReleaseCarousel";
import BookHorizontalCard from "@/components/BookHorizontalCard";
import { books } from "@/data/books";
import { formatLanguage, formatLevel, formatTopic } from "@/lib/displayFormat";

type LatestBook = {
  slug: string;
  title: string;
  language?: string;
  level?: string;
  cover?: string;
  description?: string;
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
  progressSec?: number;
};

type ContinueMobileCard = {
  kind: "continue" | "recommendation";
  item: ContinueItem;
  reason?: string;
};

type ContinueListeningApiItem = {
  bookSlug: string;
  storySlug: string;
  lastPlayedAt: string;
  progressSec?: number;
  audioDurationSec?: number;
};

type FavoriteSignalItem = {
  word: string;
  language?: string;
};

type RecommendedStoryItem = {
  key: string;
  storyId: string;
  storySlug: string;
  storyTitle: string;
  bookSlug: string;
  bookId: string;
  bookTitle: string;
  coverUrl: string;
  language?: string;
  level?: string;
  topic?: string;
  audioSrc?: string;
  text?: string;
  reason: string;
  score: number;
};

type Props = {
  latestBooks: LatestBook[];
  latestStories: LatestStory[];
  latestPolyglotStories: LatestPolyglotStory[];
  featuredWeekSlug: string | null;
  featuredDaySlug: string | null;
  initialPlan: string;
  initialTargetLanguages: string[];
  initialContinueListening: Array<{
    bookSlug: string;
    storySlug: string;
    progressSec?: number;
    audioDurationSec?: number;
  }>;
  continueLoadedOnServer: boolean;
};

const MOBILE_LIMIT = 6;
const DESKTOP_LIMIT = 10;
const CONTINUE_COMPLETION_RATIO = 0.95;

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((i) => typeof i === "string");
}

function normalizeKey(value?: string): string {
  return (value ?? "").toLowerCase().trim();
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

function formatAudioDuration(totalSeconds?: number): string {
  if (!totalSeconds || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return "--:--";
  const rounded = Math.floor(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatRemainingDuration(totalSeconds?: number, progressSec?: number): string {
  if (!totalSeconds || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return "--:-- left";
  const safeProgress =
    typeof progressSec === "number" && Number.isFinite(progressSec) && progressSec > 0
      ? progressSec
      : 0;
  const remaining = Math.max(0, Math.floor(totalSeconds - safeProgress));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")} left`;
}

function isCompletedFromAudio(progressSec?: number, audioDurationSec?: number): boolean {
  if (
    typeof progressSec !== "number" ||
    !Number.isFinite(progressSec) ||
    typeof audioDurationSec !== "number" ||
    !Number.isFinite(audioDurationSec) ||
    audioDurationSec <= 0
  ) {
    return false;
  }
  return progressSec >= audioDurationSec * CONTINUE_COMPLETION_RATIO;
}

export default function HomeClient({
  latestBooks,
  latestStories,
  latestPolyglotStories,
  featuredWeekSlug,
  featuredDaySlug,
  initialPlan,
  initialTargetLanguages,
  initialContinueListening,
  continueLoadedOnServer,
}: Props) {
  const { user, isLoaded } = useUser();
  const { userId, isLoaded: isAuthLoaded } = useAuth();

  const [continueListening, setContinueListening] = useState<ContinueItem[]>(() =>
    initialContinueListening
      .map((item) => {
        const bookMeta = Object.values(books).find((b) => b.slug === item.bookSlug);
        if (!bookMeta) return null;
        const storyMeta = bookMeta.stories.find((s) => s.slug === item.storySlug);
        if (!storyMeta) return null;
        const storyCover =
          typeof storyMeta.cover === "string" && storyMeta.cover.trim() !== ""
            ? storyMeta.cover
            : null;
        const cover =
          storyCover ??
          (typeof bookMeta.cover === "string" && bookMeta.cover.trim() !== ""
            ? bookMeta.cover
            : "/covers/default.jpg");

        return {
          bookSlug: bookMeta.slug,
          storySlug: storyMeta.slug,
          title: storyMeta.title,
          bookTitle: bookMeta.title,
          cover,
          language: storyMeta.language ?? bookMeta.language,
          level: storyMeta.level ?? bookMeta.level,
          topic: storyMeta.topic ?? bookMeta.topic,
          readMinutes: estimateReadMinutes(storyMeta.text ?? ""),
          progressSec:
            typeof item.progressSec === "number" && Number.isFinite(item.progressSec)
              ? item.progressSec
              : undefined,
          audioDurationSec:
            typeof item.audioDurationSec === "number" && Number.isFinite(item.audioDurationSec)
              ? item.audioDurationSec
              : undefined,
        } as ContinueItem;
      })
      .filter((item): item is ContinueItem => item !== null)
      .filter((item) => !isCompletedFromAudio(item.progressSec, item.audioDurationSec))
  );
  const [continueRefreshTick, setContinueRefreshTick] = useState(0);
  const [continueInitialized, setContinueInitialized] = useState(continueLoadedOnServer);
  const hasSyncedLocalContinueForUserRef = useRef<string | null>(null);
  const [favoriteSignals, setFavoriteSignals] = useState<FavoriteSignalItem[]>([]);
  const [savedBookIds, setSavedBookIds] = useState<Set<string>>(new Set());
  const [savedStoryIds, setSavedStoryIds] = useState<Set<string>>(new Set());
  const [readingHistoryStoryIds, setReadingHistoryStoryIds] = useState<Set<string>>(new Set());
  const [recommendedStoryDurations, setRecommendedStoryDurations] = useState<Record<string, number>>(
    {}
  );
  const plan = isLoaded
    ? (user?.publicMetadata?.plan as string | undefined) ?? "free"
    : initialPlan;

  const toContinueItem = (bookSlug: string, storySlug: string): ContinueItem | null => {
    const bookMeta = Object.values(books).find((b) => b.slug === bookSlug);
    if (!bookMeta) return null;
    const storyMeta = bookMeta.stories.find((s) => s.slug === storySlug);
    if (!storyMeta) return null;

    const storyCover =
      typeof storyMeta.cover === "string" && storyMeta.cover.trim() !== ""
        ? storyMeta.cover
        : null;
    const cover =
      storyCover ??
      (typeof bookMeta.cover === "string" && bookMeta.cover.trim() !== ""
        ? bookMeta.cover
        : "/covers/default.jpg");

    return {
      bookSlug: bookMeta.slug,
      storySlug: storyMeta.slug,
      title: storyMeta.title,
      bookTitle: bookMeta.title,
      cover,
      language: storyMeta.language ?? bookMeta.language,
      level: storyMeta.level ?? bookMeta.level,
      topic: storyMeta.topic ?? bookMeta.topic,
      readMinutes: estimateReadMinutes(storyMeta.text ?? ""),
    };
  };

  useEffect(() => {
    let cancelled = false;

    const loadContinueListening = async () => {
      const finish = () => {
        if (!cancelled) setContinueInitialized(true);
      };
      let localSafe: ContinueItem[] = [];

      try {
        const raw = localStorage.getItem("dp_continue_listening_v1");
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localSafe = parsed
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
                const progressSec =
                  typeof r.progressSec === "number" && Number.isFinite(r.progressSec)
                    ? r.progressSec
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
                  progressSec,
                };
              })
              .filter((i): i is ContinueItem => i !== null)
              .filter((item) => !isCompletedFromAudio(item.progressSec, item.audioDurationSec));
          }
        }
      } catch {
        // ignora datos corruptos
      }

      if (!userId) {
        if (!cancelled) {
          setContinueListening(localSafe);
        }
        finish();
        return;
      }

      // Sincroniza historial local previo del dispositivo al backend solo una vez por usuario.
      if (
        localSafe.length > 0 &&
        hasSyncedLocalContinueForUserRef.current !== userId
      ) {
        try {
          await fetch("/api/continue-listening", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: localSafe.map((item) => ({
                bookSlug: item.bookSlug,
                storySlug: item.storySlug,
                progressSec: item.progressSec,
                audioDurationSec: item.audioDurationSec,
              })),
            }),
          });
          hasSyncedLocalContinueForUserRef.current = userId;
        } catch {
          // silencioso
        }
      }

      try {
        const res = await fetch("/api/continue-listening", { cache: "no-store" });
        if (!res.ok) return;

        const remote = (await res.json()) as ContinueListeningApiItem[];
        if (!Array.isArray(remote)) return;

        const localByKey: Map<string, ContinueItem> = new Map(
          localSafe.map((item) => [`${item.bookSlug}:${item.storySlug}`, item] as const)
        );

        const hydrated = remote
          .map((item) => {
            const hydratedItem = toContinueItem(item.bookSlug, item.storySlug);
            if (!hydratedItem) return null;
            const next: ContinueItem = { ...hydratedItem };
            if (typeof item.progressSec === "number" && Number.isFinite(item.progressSec)) {
              next.progressSec = item.progressSec;
            }
            if (
              typeof item.audioDurationSec === "number" &&
              Number.isFinite(item.audioDurationSec)
            ) {
              next.audioDurationSec = item.audioDurationSec;
            }
            return next;
          })
          .filter((item): item is ContinueItem => item !== null);

        const merged = hydrated
          .map((item) => {
          const key = `${item.bookSlug}:${item.storySlug}`;
          const local = localByKey.get(key);
          if (!local) return item;
          return {
            ...item,
            audioDurationSec: item.audioDurationSec ?? local.audioDurationSec,
            progressSec: item.progressSec ?? local.progressSec,
          };
          })
          .filter((item) => !isCompletedFromAudio(item.progressSec, item.audioDurationSec));

        if (cancelled) return;
        setContinueListening(merged);
        localStorage.setItem("dp_continue_listening_v1", JSON.stringify(merged));
      } catch {
        if (!cancelled) {
          setContinueListening([]);
        }
      } finally {
        finish();
      }
    };

    void loadContinueListening();

    return () => {
      cancelled = true;
    };
  }, [userId, continueRefreshTick]);

  const isPersonalizationReady = isAuthLoaded && isLoaded && continueInitialized;

  useEffect(() => {
    const refresh = () => setContinueRefreshTick((v) => v + 1);

    const handleContinueListeningUpdated = () => refresh();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "dp_continue_listening_v1") refresh();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("continue-listening-updated", handleContinueListeningUpdated);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("continue-listening-updated", handleContinueListeningUpdated);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
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

  useEffect(() => {
    let cancelled = false;

    const loadPersonalizationSignals = async () => {
      if (!userId || (plan !== "premium" && plan !== "polyglot")) {
        if (!cancelled) {
          setFavoriteSignals([]);
          setSavedBookIds(new Set());
          setSavedStoryIds(new Set());
          setReadingHistoryStoryIds(new Set());
        }
        return;
      }

      try {
        const [favoritesRes, libraryBooksRes, libraryStoriesRes] = await Promise.all([
          fetch("/api/favorites", { cache: "no-store" }),
          fetch("/api/library?type=book", { cache: "no-store" }),
          fetch("/api/library?type=story", { cache: "no-store" }),
        ]);

        if (cancelled) return;

        if (favoritesRes.ok) {
          const raw: unknown = await favoritesRes.json();
          if (Array.isArray(raw)) {
            const parsed = raw
              .map((row): FavoriteSignalItem | null => {
                if (typeof row !== "object" || row === null) return null;
                const record = row as Record<string, unknown>;
                if (typeof record.word !== "string") return null;
                return {
                  word: record.word,
                  language: typeof record.language === "string" ? record.language : undefined,
                };
              })
              .filter((item): item is FavoriteSignalItem => item !== null);
            setFavoriteSignals(parsed);
          }
        }

        if (libraryBooksRes.ok) {
          const raw: unknown = await libraryBooksRes.json();
          if (Array.isArray(raw)) {
            const ids = raw
              .map((row) => {
                if (typeof row !== "object" || row === null) return null;
                const record = row as Record<string, unknown>;
                return typeof record.bookId === "string" ? record.bookId : null;
              })
              .filter((id): id is string => !!id);
            setSavedBookIds(new Set(ids));
          }
        }

        if (libraryStoriesRes.ok) {
          const raw: unknown = await libraryStoriesRes.json();
          if (Array.isArray(raw)) {
            const ids = raw
              .map((row) => {
                if (typeof row !== "object" || row === null) return null;
                const record = row as Record<string, unknown>;
                return typeof record.storyId === "string" ? record.storyId : null;
              })
              .filter((id): id is string => !!id);
            setSavedStoryIds(new Set(ids));
          }
        }
      } catch {
        if (!cancelled) {
          setFavoriteSignals([]);
          setSavedBookIds(new Set());
          setSavedStoryIds(new Set());
        }
      }

      try {
        const raw = localStorage.getItem("dp_reading_history_v1");
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (!cancelled && Array.isArray(parsed)) {
          const ids = parsed
            .map((row) => {
              if (typeof row !== "object" || row === null) return null;
              const record = row as Record<string, unknown>;
              return typeof record.storyId === "string" ? record.storyId : null;
            })
            .filter((id): id is string => !!id);
          setReadingHistoryStoryIds(new Set(ids));
        }
      } catch {
        if (!cancelled) setReadingHistoryStoryIds(new Set());
      }
    };

    void loadPersonalizationSignals();

    return () => {
      cancelled = true;
    };
  }, [plan, userId]);

  const targetLanguagesUnknown = isLoaded
    ? (user?.publicMetadata?.targetLanguages as unknown)
    : (initialTargetLanguages as unknown);

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
  const [latestStoryDurations, setLatestStoryDurations] = useState<Record<string, number>>({});
  const canShowPersonalizedRecommendations =
    isPersonalizationReady && (plan === "premium" || plan === "polyglot");

  const latestStoryTopicByKey = useMemo(() => {
    const topicByKey: Record<string, string | undefined> = {};
    for (const story of storiesForHome) {
      const bookMeta = Object.values(books).find((b) => b.slug === story.bookSlug);
      const storyMeta = bookMeta?.stories.find((s) => s.slug === story.storySlug);
      topicByKey[`${story.bookSlug}:${story.storySlug}`] = storyMeta?.topic ?? bookMeta?.topic;
    }
    return topicByKey;
  }, [storiesForHome]);

  const recommendedStories = useMemo<RecommendedStoryItem[]>(() => {
    if (!canShowPersonalizedRecommendations) return [];

    const continueSet = new Set(
      continueListening.map((item) => `${item.bookSlug}:${item.storySlug}`)
    );

    const preferredLanguageSet = new Set<string>();
    if (languageFilter) {
      for (const lang of languageFilter) preferredLanguageSet.add(lang);
    }
    for (const favorite of favoriteSignals) {
      if (favorite.language) preferredLanguageSet.add(normalizeKey(favorite.language));
    }

    const preferredLevelSet = new Set<string>();
    const topicWeights = new Map<string, number>();

    for (const entry of continueListening) {
      if (entry.level) preferredLevelSet.add(normalizeKey(entry.level));
      if (entry.topic) {
        const key = normalizeKey(entry.topic);
        topicWeights.set(key, (topicWeights.get(key) ?? 0) + 2);
      }
    }

    for (const bookMeta of Object.values(books)) {
      if (!savedBookIds.has(bookMeta.id) && !savedBookIds.has(bookMeta.slug)) continue;
      if (bookMeta.level) preferredLevelSet.add(normalizeKey(bookMeta.level));
      if (bookMeta.topic) {
        const key = normalizeKey(bookMeta.topic);
        topicWeights.set(key, (topicWeights.get(key) ?? 0) + 2);
      }
    }

    for (const favorite of favoriteSignals) {
      const key = normalizeKey(favorite.word);
      if (key.length < 3) continue;
      topicWeights.set(key, (topicWeights.get(key) ?? 0) + 1);
    }

    const favoriteWords = favoriteSignals
      .map((f) => normalizeKey(f.word))
      .filter((w) => w.length >= 4)
      .slice(0, 40);

    const candidates: RecommendedStoryItem[] = [];

    for (const bookMeta of Object.values(books)) {
      const bookSaved = savedBookIds.has(bookMeta.id) || savedBookIds.has(bookMeta.slug);
      for (const story of bookMeta.stories) {
        const key = `${bookMeta.slug}:${story.slug}`;
        const storySaved =
          savedStoryIds.has(story.id) ||
          savedStoryIds.has(story.slug) ||
          savedStoryIds.has(key);
        const alreadyRead = readingHistoryStoryIds.has(story.id) || readingHistoryStoryIds.has(story.slug);
        const inContinue = continueSet.has(key);
        if (storySaved || alreadyRead || inContinue) continue;

        const language = story.language ?? bookMeta.language;
        const level = story.level ?? bookMeta.level;
        const topic = story.topic ?? bookMeta.topic;
        const text = stripHtml(story.text ?? "").toLowerCase();
        const coverUrl =
          typeof story.cover === "string" && story.cover.trim() !== ""
            ? story.cover
            : typeof bookMeta.cover === "string" && bookMeta.cover.trim() !== ""
              ? bookMeta.cover
              : "/covers/default.jpg";
        const rawAudio = typeof story.audio === "string" ? story.audio.trim() : "";
        const audioSrc = rawAudio
          ? rawAudio.startsWith("http")
            ? rawAudio
            : `https://cdn.sanity.io/files/9u7ilulp/production/${rawAudio}.mp3`
          : undefined;

        let score = 0;
        let reason = "Picked for your profile";

        if (bookSaved) {
          score += 14;
          reason = "From a book in your library";
        }
        if (language && preferredLanguageSet.has(normalizeKey(language))) {
          score += 8;
          if (reason === "Picked for your profile") reason = "Matches your language focus";
        }
        if (level && preferredLevelSet.has(normalizeKey(level))) {
          score += 5;
          if (reason === "Picked for your profile") reason = "Matches your current level";
        }
        if (topic) {
          const topicKey = normalizeKey(topic);
          const topicScore = topicWeights.get(topicKey) ?? 0;
          if (topicScore > 0) {
            score += Math.min(10, topicScore * 2);
            reason = `More ${formatTopic(topic)}`;
          }
        }

        let vocabMatches = 0;
        for (const word of favoriteWords) {
          if (text.includes(word)) vocabMatches += 1;
        }
        if (vocabMatches > 0) {
          score += Math.min(12, vocabMatches * 2);
          if (!bookSaved && vocabMatches >= 2) reason = "Contains words you saved";
        }

        if (score <= 0) continue;

        candidates.push({
          key,
          storyId: story.id,
          storySlug: story.slug,
          storyTitle: story.title,
          bookSlug: bookMeta.slug,
          bookId: bookMeta.id,
          bookTitle: bookMeta.title,
          coverUrl,
          language,
          level,
          topic,
          audioSrc,
          text: story.text,
          reason,
          score,
        });
      }
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, 12);
  }, [
    canShowPersonalizedRecommendations,
    continueListening,
    favoriteSignals,
    languageFilter,
    readingHistoryStoryIds,
    savedBookIds,
    savedStoryIds,
  ]);

  useEffect(() => {
    if (storiesForHome.length === 0) return;

    const unresolved = storiesForHome.filter((story) => {
      const key = `${story.bookSlug}:${story.storySlug}`;
      return !(typeof latestStoryDurations[key] === "number" && latestStoryDurations[key] > 0);
    });
    if (unresolved.length === 0) return;

    let cancelled = false;

    const loadDuration = (story: LatestStory) =>
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
      setLatestStoryDurations((prev) => {
        const next = { ...prev };
        for (const result of resolved) {
          if (result.durationSec && result.durationSec > 0) {
            next[result.key] = result.durationSec;
          }
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [storiesForHome, latestStoryDurations]);

  useEffect(() => {
    if (recommendedStories.length === 0) return;

    const unresolved = recommendedStories.filter((story) => {
      return (
        !!story.audioSrc &&
        !(typeof recommendedStoryDurations[story.key] === "number" && recommendedStoryDurations[story.key] > 0)
      );
    });
    if (unresolved.length === 0) return;

    let cancelled = false;

    const loadDuration = (story: RecommendedStoryItem) =>
      new Promise<{ key: string; durationSec?: number }>((resolve) => {
        if (!story.audioSrc) {
          resolve({ key: story.key });
          return;
        }

        const audio = new Audio();
        audio.preload = "metadata";

        const done = (durationSec?: number) => {
          audio.removeAttribute("src");
          audio.load();
          resolve({ key: story.key, durationSec });
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

        audio.src = story.audioSrc;
      });

    Promise.all(unresolved.map(loadDuration)).then((resolved) => {
      if (cancelled || resolved.length === 0) return;
      setRecommendedStoryDurations((prev) => {
        const next = { ...prev };
        for (const result of resolved) {
          if (result.durationSec && result.durationSec > 0) {
            next[result.key] = result.durationSec;
          }
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [recommendedStories, recommendedStoryDurations]);

  const withReturnContext = (href: string) => {
    const [base, existingQuery = ""] = href.split("?");
    const params = new URLSearchParams(existingQuery);
    params.set("returnTo", "/");
    params.set("returnLabel", "Home");
    params.set("from", "home");
    return `${base}?${params.toString()}`;
  };

  const featuredFreeStory = useMemo(() => {
    const targetSlug =
      plan === "basic"
        ? featuredDaySlug ?? featuredWeekSlug
        : plan === "free"
          ? featuredWeekSlug
          : null;
    if (!targetSlug) return null;

    for (const book of Object.values(books)) {
      const story = book.stories.find((s) => s.slug === targetSlug);
      if (!story) continue;
      return {
        label: plan === "basic" ? "Story of the Day" : "Story of the Week",
        href: withReturnContext(`/books/${book.slug}/${story.slug}`),
        title: story.title,
        bookTitle: book.title,
        cover:
          typeof story.cover === "string" && story.cover.trim() !== ""
            ? story.cover
            : typeof book.cover === "string" && book.cover.trim() !== ""
              ? book.cover
              : "/covers/default.jpg",
        language: story.language ?? book.language,
        level: story.level ?? book.level,
        topic: story.topic ?? book.topic,
      };
    }
    return null;
  }, [plan, featuredDaySlug, featuredWeekSlug]);

  const mobileContinueCards = useMemo<ContinueMobileCard[]>(() => {
    if (continueListening.length === 0) return [];

    const baseCards: ContinueMobileCard[] = continueListening.map((item) => ({
      kind: "continue",
      item,
    }));

    if (continueListening.length !== 1) return baseCards;

    const base = continueListening[0];
    const baseKey = `${base.bookSlug}:${base.storySlug}`;
    const baseLanguage = (base.language ?? "").toLowerCase();
    const baseTopic = (base.topic ?? "").toLowerCase();

    const candidates = storiesForHome
      .filter((s) => `${s.bookSlug}:${s.storySlug}` !== baseKey)
      .map((s) => {
        const bookMeta = Object.values(books).find((b) => b.slug === s.bookSlug);
        const storyMeta = bookMeta?.stories.find((st) => st.slug === s.storySlug);
        const topic = (storyMeta?.topic ?? bookMeta?.topic ?? "").toLowerCase();
        const language = (s.language ?? storyMeta?.language ?? bookMeta?.language ?? "").toLowerCase();

        let score = 0;
        if (s.bookSlug === base.bookSlug) score += 4;
        if (language && language === baseLanguage) score += 3;
        if (topic && baseTopic && topic === baseTopic) score += 5;

        const recommendation: ContinueItem = {
          bookSlug: s.bookSlug,
          storySlug: s.storySlug,
          title: s.storyTitle,
          bookTitle: s.bookTitle,
          cover: s.coverUrl,
          language: s.language ?? storyMeta?.language ?? bookMeta?.language,
          level: s.level ?? storyMeta?.level ?? bookMeta?.level,
          topic: storyMeta?.topic ?? bookMeta?.topic,
        };

        return { score, recommendation };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((entry) => ({
        kind: "recommendation" as const,
        item: entry.recommendation,
        reason: "Recommended for you",
      }));

    return [...baseCards, ...candidates];
  }, [continueListening, storiesForHome]);

  const continueDesktopCardWidthClass =
    continueListening.length === 1
      ? "w-[420px] lg:w-[460px]"
      : continueListening.length === 2
        ? "w-[360px] lg:w-[400px]"
        : "w-[320px] lg:w-[340px]";

  const renderContinueCard = (
    item: ContinueItem,
    options?: { recommendation?: boolean; reason?: string }
  ) => (
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
          {options?.recommendation ? (
            <p className="inline-flex text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-2 py-0.5 mb-2">
              {options.reason ?? "Recommended"}
            </p>
          ) : null}
          <h3 className="text-xl font-semibold mb-2 text-white line-clamp-2">
            {item.title}
          </h3>
          <p className="text-sky-300 text-sm leading-relaxed line-clamp-1">
            {item.bookTitle}
          </p>
        </div>

        <div className="mt-3 text-sm text-gray-400 space-y-1">
          <p>
            {formatLanguage(item.language)} · {formatLevel(item.level)}
          </p>
          <p>
            {formatRemainingDuration(item.audioDurationSec, item.progressSec)} ·{" "}
            {formatTopic(item.topic)}
          </p>
        </div>
      </div>
    </Link>
  );

  return (
    <div className="min-h-full w-full text-white flex flex-col items-center px-8 pb-28">
      <>
      {/* Free featured story for free/basic users */}
      {isPersonalizationReady && featuredFreeStory && continueListening.length === 0 && (
        <section className="w-full max-w-5xl text-center pt-10 mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300 mb-3">
            {featuredFreeStory.label}
          </p>
          <h2 className="text-2xl font-semibold mb-6">Your free story</h2>
          <div className="max-w-[520px] mx-auto">
            <Link
              href={featuredFreeStory.href}
              className="flex flex-col bg-white/5 hover:bg-white/10 transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
            >
              <div className="w-full h-48 bg-gray-800">
                <img
                  src={featuredFreeStory.cover}
                  alt={featuredFreeStory.title}
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="p-5 flex flex-col justify-between flex-1 text-left">
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-white line-clamp-2">
                    {featuredFreeStory.title}
                  </h3>
                  <p className="text-sky-300 text-sm leading-relaxed line-clamp-1">
                    {featuredFreeStory.bookTitle}
                  </p>
                </div>
                <p className="mt-3 text-sm text-gray-400">
                  {formatLanguage(featuredFreeStory.language)} · {formatLevel(featuredFreeStory.level)} ·{" "}
                  {formatTopic(featuredFreeStory.topic)}
                </p>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Continue listening */}
      {isPersonalizationReady && continueListening.length > 0 && (
        <section className="w-full max-w-5xl text-center pt-10 mb-12">
          <h2 className="text-2xl font-semibold mb-6">Continue listening</h2>

          <div className="md:hidden min-h-[240px]">
            <StoryCarousel
              items={mobileContinueCards}
              renderItem={(entry) =>
                renderContinueCard(entry.item, {
                  recommendation: entry.kind === "recommendation",
                  reason: entry.reason,
                })
              }
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

      {isPersonalizationReady && featuredFreeStory && continueListening.length > 0 && (
        <section className="w-full max-w-5xl text-center mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300 mb-3">
            {featuredFreeStory.label}
          </p>
          <h2 className="text-2xl font-semibold mb-6">Your free story</h2>
          <div className="max-w-[520px] mx-auto">
            <Link
              href={featuredFreeStory.href}
              className="flex flex-col bg-white/5 hover:bg-white/10 transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
            >
              <div className="w-full h-48 bg-gray-800">
                <img
                  src={featuredFreeStory.cover}
                  alt={featuredFreeStory.title}
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="p-5 flex flex-col justify-between flex-1 text-left">
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-white line-clamp-2">
                    {featuredFreeStory.title}
                  </h3>
                  <p className="text-sky-300 text-sm leading-relaxed line-clamp-1">
                    {featuredFreeStory.bookTitle}
                  </p>
                </div>
                <p className="mt-3 text-sm text-gray-400">
                  {formatLanguage(featuredFreeStory.language)} · {formatLevel(featuredFreeStory.level)} ·{" "}
                  {formatTopic(featuredFreeStory.topic)}
                </p>
              </div>
            </Link>
          </div>
        </section>
      )}

      {canShowPersonalizedRecommendations && recommendedStories.length > 0 && (
        <section className="mb-12 text-center w-full max-w-5xl">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-300 mb-2">
              Premium personalization
            </p>
            <h2 className="text-2xl font-semibold text-white">Recommended for you</h2>
          </div>

          <div className="min-h-[320px]">
            <StoryCarousel
              items={recommendedStories}
              renderItem={(story) => (
                <Link
                  key={story.key}
                  href={withReturnContext(`/books/${story.bookSlug}/${story.storySlug}`)}
                  className="flex flex-col bg-white/5 hover:bg-white/10 transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
                >
                  <div className="w-full h-48 bg-gray-800">
                    <img
                      src={story.coverUrl}
                      alt={story.storyTitle}
                      className="object-cover w-full h-full"
                    />
                  </div>

                  <div className="p-5 flex flex-col justify-between flex-1 text-left">
                    <div>
                      <p className="inline-flex text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-2 py-0.5 mb-2">
                        {story.reason}
                      </p>
                      <h3 className="text-xl font-semibold mb-2 text-white line-clamp-2">
                        {story.storyTitle}
                      </h3>
                      <p className="text-sky-300 text-sm leading-relaxed line-clamp-1">
                        {story.bookTitle}
                      </p>
                    </div>

                    <div className="mt-3 text-sm text-gray-400 space-y-1">
                      <p>
                        {formatLanguage(story.language)} · {formatLevel(story.level)}
                      </p>
                      <p>
                        {formatAudioDuration(recommendedStoryDurations[story.key])} ·{" "}
                        {formatTopic(story.topic)}
                      </p>
                    </div>
                  </div>
                </Link>
              )}
            />
          </div>
        </section>
      )}

      {/* Latest Books */}
      <section className="mb-12 text-center w-full max-w-5xl">
        <h2 className="text-2xl font-semibold mb-6 text-white">Latest Books</h2>

        <div className="md:hidden min-h-[240px]">
          <StoryCarousel
            items={filteredBooks.slice(0, MOBILE_LIMIT)}
            renderItem={(book) => (
              <BookHorizontalCard
                key={book.slug}
                href={`/books/${book.slug}?from=home`}
                title={book.title}
                cover={book.cover}
                meta={`${formatLanguage(book.language)} · ${formatLevel(book.level)}`}
                description={book.description}
              />
            )}
          />
        </div>

        <div className="hidden md:block">
          <ReleaseCarousel
            items={filteredBooks.slice(0, DESKTOP_LIMIT)}
            itemClassName="md:flex-[0_0_46%] lg:flex-[0_0_46%] xl:flex-[0_0_46%]"
            renderItem={(book) => (
              <BookHorizontalCard
                title={book.title}
                cover={book.cover}
                meta={`${formatLanguage(book.language)} · ${formatLevel(book.level)}`}
                description={book.description}
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
            renderItem={(s) => {
              const key = `${s.bookSlug}:${s.storySlug}`;
              const topic = latestStoryTopicByKey[key];
              const durationSec = latestStoryDurations[key];
              return (
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

                  <div className="mt-3 text-sm text-gray-400 space-y-1">
                    <p>
                      {formatLanguage(s.language)} · {formatLevel(s.level)}
                    </p>
                    <p>
                      {formatAudioDuration(durationSec)} · {formatTopic(topic)}
                    </p>
                  </div>
                </div>
              </Link>
              );
            }}
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
                    {formatLanguage(story.language)} · {formatLevel(story.level)}
                  </p>
                </div>
              </Link>
            )}
          />
        </div>
      </section>
      </>
    </div>
  );
}
