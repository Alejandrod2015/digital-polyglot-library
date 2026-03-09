"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import StoryCarousel from "@/components/StoryCarousel";
import ReleaseCarousel from "@/components/ReleaseCarousel";
import BookHorizontalCard from "@/components/BookHorizontalCard";
import LevelBadge from "@/components/LevelBadge";
import LanguageBadge from "@/components/LanguageBadge";
import RegionBadge from "@/components/RegionBadge";
import { books } from "@/data/books";
import { formatTopic } from "@/lib/displayFormat";
import { getBookCardMeta } from "@/lib/bookCardMeta";

type LatestBook = {
  slug: string;
  title: string;
  language?: string;
  region?: string;
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
  region?: string;
  level?: string;
  coverUrl: string;
  audioUrl?: string;
  topic?: string;
};

type LatestPolyglotStory = {
  slug: string;
  title: string;
  language?: string;
  region?: string;
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
  region?: string;
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
  wordType?: string;
  nextReviewAt?: string | null;
  streak?: number;
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
  region?: string;
  level?: string;
  topic?: string;
  audioSrc?: string;
  text?: string;
  reason: string;
  score: number;
};

type DailyLoopStory = {
  href: string;
  title: string;
  label: string;
  detail: string;
};

type HomeStoryCard =
  | {
      kind: "catalog";
      key: string;
      href: string;
      title: string;
      subtitle: string;
      coverUrl: string;
      level?: string;
      language?: string;
      region?: string;
      detail: string;
    }
  | {
      kind: "polyglot";
      key: string;
      href: string;
      title: string;
      subtitle: string;
      coverUrl: string;
      level?: string;
      language?: string;
      region?: string;
      detail: string;
    };

type Props = {
  latestBooks: LatestBook[];
  latestStories: LatestStory[];
  latestPolyglotStories: LatestPolyglotStory[];
  featuredWeekSlug: string | null;
  featuredDaySlug: string | null;
  initialPlan: string;
  initialTargetLanguages: string[];
  initialInterests: string[];
  initialHasUser: boolean;
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

function normalizeForMatch(value?: string): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokenizeForMatch(value?: string): Set<string> {
  const normalized = normalizeForMatch(value);
  if (!normalized) return new Set();
  const tokens = normalized.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);
  return new Set(tokens);
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

function hasAudioSource(bookSlug: string, storySlug: string, audioUrl?: string): boolean {
  if (typeof audioUrl === "string" && audioUrl.trim() !== "") return true;
  if (bookSlug === "standalone") return false;
  const bookMeta = Object.values(books).find((b) => b.slug === bookSlug);
  const storyMeta = bookMeta?.stories.find((s) => s.slug === storySlug);
  const rawSrc = typeof storyMeta?.audio === "string" ? storyMeta.audio.trim() : "";
  return rawSrc.length > 0;
}

async function trackBusinessMetric(eventType: string, value?: number) {
  try {
    await fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storySlug: "__plans__",
        bookSlug: "billing",
        eventType,
        value,
      }),
    });
  } catch {
    // silent
  }
}

export default function HomeClient({
  latestBooks,
  latestStories,
  latestPolyglotStories,
  featuredWeekSlug,
  featuredDaySlug,
  initialPlan,
  initialTargetLanguages,
  initialInterests,
  initialHasUser,
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
          region: storyMeta.region ?? bookMeta.region,
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
  const lastContinueRefreshAtRef = useRef(0);
  const [favoriteSignals, setFavoriteSignals] = useState<FavoriteSignalItem[]>([]);
  const [savedBookIds, setSavedBookIds] = useState<Set<string>>(new Set());
  const [savedStoryIds, setSavedStoryIds] = useState<Set<string>>(new Set());
  const [readingHistoryStoryIds, setReadingHistoryStoryIds] = useState<Set<string>>(new Set());
  const [personalizationSignalsLoaded, setPersonalizationSignalsLoaded] = useState(false);
  const [recommendedStoryDurations, setRecommendedStoryDurations] = useState<Record<string, number>>(
    {}
  );
  const plan = isLoaded
    ? (user?.publicMetadata?.plan as string | undefined) ?? "free"
    : initialPlan;
  const hasSession = isAuthLoaded ? Boolean(userId) : initialHasUser;
  const trialStartedAt = isLoaded
    ? (user?.publicMetadata?.trialStartedAt as string | undefined)
    : undefined;

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
      region: storyMeta.region ?? bookMeta.region,
      level: storyMeta.level ?? bookMeta.level,
      topic: storyMeta.topic ?? bookMeta.topic,
      readMinutes: estimateReadMinutes(storyMeta.text ?? ""),
    };
  };

  useEffect(() => {
    if (!isLoaded || !userId) return;
    if (plan !== "premium" && plan !== "polyglot") return;
    if (!trialStartedAt) return;
    if (typeof window === "undefined") return;

    const startedAt = new Date(trialStartedAt);
    if (Number.isNaN(startedAt.getTime())) return;
    if (Date.now() - startedAt.getTime() < 24 * 60 * 60 * 1000) return;

    const key = `dp_trial_day1_active_sent_v1:${userId}`;
    if (window.localStorage.getItem(key) === "1") return;

    void trackBusinessMetric("trial_day_1_active", 1);
    window.localStorage.setItem(key, "1");
  }, [isLoaded, userId, plan, trialStartedAt]);

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
                const region =
                  typeof r.region === "string"
                    ? r.region
                    : storyMeta?.region ?? bookMeta?.region;
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
                  region,
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
        const nextRaw = JSON.stringify(merged);
        if (localStorage.getItem("dp_continue_listening_v1") !== nextRaw) {
          localStorage.setItem("dp_continue_listening_v1", nextRaw);
        }
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
    const refresh = () => {
      const now = Date.now();
      if (now - lastContinueRefreshAtRef.current < 1500) return;
      lastContinueRefreshAtRef.current = now;
      setContinueRefreshTick((v) => v + 1);
    };

    const handleContinueListeningUpdated = () => refresh();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "dp_continue_listening_v1" && e.newValue !== e.oldValue) refresh();
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
      (item) =>
        !(typeof item.audioDurationSec === "number" && item.audioDurationSec > 0) &&
        hasAudioSource(item.bookSlug, item.storySlug)
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
        let changed = false;
        const next = prev.map((item) => {
          const key = `${item.bookSlug}:${item.storySlug}`;
          const found = resolved.find((r) => r.key === key);
          if (!found || !found.durationSec) return item;
          if (item.audioDurationSec === found.durationSec) return item;
          changed = true;
          return { ...item, audioDurationSec: found.durationSec };
        });

        if (!changed) return prev;

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
          setPersonalizationSignalsLoaded(true);
        }
        return;
      }

      if (!cancelled) {
        setPersonalizationSignalsLoaded(false);
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
                  wordType: typeof record.wordType === "string" ? record.wordType : undefined,
                  nextReviewAt:
                    typeof record.nextReviewAt === "string" || record.nextReviewAt === null
                      ? (record.nextReviewAt as string | null)
                      : undefined,
                  streak: typeof record.streak === "number" ? record.streak : undefined,
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
      } finally {
        if (!cancelled) setPersonalizationSignalsLoaded(true);
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
  const interestsUnknown = isLoaded
    ? (user?.publicMetadata?.interests as unknown)
    : (initialInterests as unknown);

  const languageFilter = useMemo(() => {
    if (!isStringArray(targetLanguagesUnknown) || targetLanguagesUnknown.length === 0)
      return null;
    return new Set(targetLanguagesUnknown.map((l) => l.toLowerCase()));
  }, [targetLanguagesUnknown]);
  const preferredLevel = useMemo(() => {
    const raw = isLoaded ? user?.publicMetadata?.preferredLevel : undefined;
    return typeof raw === "string" ? raw.toLowerCase().trim() : "";
  }, [isLoaded, user]);
  const preferredRegion = useMemo(() => {
    const raw = isLoaded ? user?.publicMetadata?.preferredRegion : undefined;
    return typeof raw === "string" ? raw.toLowerCase().trim() : "";
  }, [isLoaded, user]);
  const interestFilter = useMemo(() => {
    if (!isStringArray(interestsUnknown) || interestsUnknown.length === 0) return null;
    const normalized = interestsUnknown
      .map((item) => normalizeForMatch(item))
      .filter((item) => item.length >= 2);
    if (normalized.length === 0) return null;
    return new Set(normalized);
  }, [interestsUnknown]);

  const filteredBooks = useMemo(() => {
    if (!languageFilter) return latestBooks;
    return latestBooks.filter((b) => languageFilter.has((b.language ?? "").toLowerCase()));
  }, [latestBooks, languageFilter]);

  const bookMetaBySlug = useMemo(() => {
    const map = new Map<string, { statsLine?: string; topicsLine?: string }>();
    for (const book of Object.values(books)) {
      map.set(book.slug, getBookCardMeta(book));
    }
    return map;
  }, []);

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

  const withReturnContext = (href: string) => {
    const [base, existingQuery = ""] = href.split("?");
    const params = new URLSearchParams(existingQuery);
    params.set("returnTo", "/");
    params.set("returnLabel", "Home");
    params.set("from", "home");
    return `${base}?${params.toString()}`;
  };

  const storiesForHome = filteredStories.slice(0, DESKTOP_LIMIT);
  const polyglotForHome = filteredPolyglot.slice(0, DESKTOP_LIMIT);
  const [latestStoryDurations, setLatestStoryDurations] = useState<Record<string, number>>({});
  const canShowPersonalizedRecommendations =
    isPersonalizationReady && (plan === "premium" || plan === "polyglot");
  const isPersonalizationSettled =
    !canShowPersonalizedRecommendations || personalizationSignalsLoaded;

  const latestStoryTopicByKey = useMemo(() => {
    const topicByKey: Record<string, string | undefined> = {};
    for (const story of storiesForHome) {
      if (story.bookSlug === "standalone") {
        topicByKey[`${story.bookSlug}:${story.storySlug}`] = story.topic;
        continue;
      }
      const bookMeta = Object.values(books).find((b) => b.slug === story.bookSlug);
      const storyMeta = bookMeta?.stories.find((s) => s.slug === story.storySlug);
      topicByKey[`${story.bookSlug}:${story.storySlug}`] = storyMeta?.topic ?? bookMeta?.topic;
    }
    return topicByKey;
  }, [storiesForHome]);

  const latestHomeStories = useMemo<HomeStoryCard[]>(() => {
    const catalogCards = storiesForHome.map((s) => {
      const key = `${s.bookSlug}:${s.storySlug}`;
      return {
        kind: "catalog" as const,
        key,
        href:
          s.bookSlug === "standalone"
            ? withReturnContext(`/stories/${s.storySlug}`)
            : withReturnContext(`/books/${s.bookSlug}/${s.storySlug}`),
        title: s.storyTitle || "Untitled story",
        subtitle: s.bookTitle || s.bookSlug,
        coverUrl: s.coverUrl,
        level: s.level,
        language: s.language,
        region: s.region,
        detail: `${formatAudioDuration(latestStoryDurations[key])} · ${formatTopic(
          latestStoryTopicByKey[key]
        )}`,
      };
    });

    const polyglotCards = polyglotForHome.map((story) => ({
      kind: "polyglot" as const,
      key: story.slug,
      href: withReturnContext(`/stories/${story.slug}`),
      title: story.title,
      subtitle: "Individual Story",
      coverUrl:
        typeof story.coverUrl === "string" && story.coverUrl.trim() !== ""
          ? story.coverUrl
          : "/covers/default.jpg",
      level: story.level,
      language: story.language,
      region: story.region,
      detail: stripHtml(story.text ?? "").slice(0, 120).trim()
        ? `${stripHtml(story.text ?? "").slice(0, 120).trim()}...`
        : "Fresh polyglot story",
    }));

    return [...catalogCards, ...polyglotCards];
  }, [
    latestStoryDurations,
    latestStoryTopicByKey,
    polyglotForHome,
    storiesForHome,
  ]);

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
    const preferredRegionSet = new Set<string>();
    const topicWeights = new Map<string, number>();

    if (preferredLevel) preferredLevelSet.add(normalizeKey(preferredLevel));
    if (preferredRegion) preferredRegionSet.add(normalizeKey(preferredRegion));

    for (const entry of continueListening) {
      if (entry.level) preferredLevelSet.add(normalizeKey(entry.level));
      if (entry.region) preferredRegionSet.add(normalizeKey(entry.region));
      if (entry.topic) {
        const key = normalizeKey(entry.topic);
        topicWeights.set(key, (topicWeights.get(key) ?? 0) + 2);
      }
    }

    for (const bookMeta of Object.values(books)) {
      if (!savedBookIds.has(bookMeta.id) && !savedBookIds.has(bookMeta.slug)) continue;
      if (bookMeta.level) preferredLevelSet.add(normalizeKey(bookMeta.level));
      if (bookMeta.region) preferredRegionSet.add(normalizeKey(bookMeta.region));
      if (bookMeta.topic) {
        const key = normalizeKey(bookMeta.topic);
        topicWeights.set(key, (topicWeights.get(key) ?? 0) + 2);
      }
    }

    const now = Date.now();
    const favoriteProfiles = favoriteSignals
      .map((favorite) => {
        const wordRaw = typeof favorite.word === "string" ? favorite.word.trim() : "";
        if (!wordRaw) return null;
        const normalizedWord = normalizeForMatch(wordRaw);
        if (normalizedWord.length < 3) return null;
        const isExpression = /\s|-/.test(normalizedWord);
        const dueAt =
          typeof favorite.nextReviewAt === "string" ? Date.parse(favorite.nextReviewAt) : Number.NaN;
        const isDue = Number.isFinite(dueAt) && dueAt <= now;
        const streak = typeof favorite.streak === "number" && Number.isFinite(favorite.streak)
          ? favorite.streak
          : 0;
        const difficultyBoost = favorite.wordType === "expression" ? 2 : 1;
        return {
          word: normalizedWord,
          language: normalizeForMatch(favorite.language),
          isExpression,
          isDue,
          streak,
          difficultyBoost,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, 120);

    for (const favorite of favoriteProfiles) {
      topicWeights.set(favorite.word, (topicWeights.get(favorite.word) ?? 0) + favorite.difficultyBoost);
    }

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
        const region = story.region ?? bookMeta.region;
        const level = story.level ?? bookMeta.level;
        const topic = story.topic ?? bookMeta.topic;
        const normalizedText = normalizeForMatch(stripHtml(story.text ?? ""));
        const textTokens = tokenizeForMatch(story.text ?? "");
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
        if (region && preferredRegionSet.has(normalizeKey(region))) {
          score += 4;
          if (reason === "Picked for your profile") reason = "Matches your region focus";
        }
        if (interestFilter && interestFilter.size > 0) {
          const topicKey = normalizeForMatch(topic);
          let interestMatches = 0;
          if (topicKey) {
            for (const interest of interestFilter) {
              if (topicKey.includes(interest) || interest.includes(topicKey)) {
                interestMatches += 1;
              }
            }
          }
          if (interestMatches === 0) {
            for (const interest of interestFilter) {
              if (normalizedText.includes(interest)) interestMatches += 1;
              if (interestMatches >= 2) break;
            }
          }
          if (interestMatches > 0) {
            score += Math.min(12, interestMatches * 6);
            if (reason === "Picked for your profile") reason = "Matches your interests";
          }
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
        let dueMatches = 0;
        let weakMatches = 0;
        const languageKey = normalizeForMatch(language);
        for (const favorite of favoriteProfiles) {
          if (favorite.language && languageKey && favorite.language !== languageKey) continue;
          const hasMatch = favorite.isExpression
            ? normalizedText.includes(favorite.word)
            : textTokens.has(favorite.word);
          if (!hasMatch) continue;
          vocabMatches += 1;
          if (favorite.isDue) dueMatches += 1;
          if (favorite.streak <= 2) weakMatches += 1;
        }
        if (dueMatches > 0) {
          score += Math.min(24, dueMatches * 6);
          reason = "Practice your due words";
        } else if (weakMatches > 0) {
          score += Math.min(18, weakMatches * 4);
          if (!bookSaved) reason = "Strengthen your weak vocabulary";
        } else if (vocabMatches > 0) {
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
          region,
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
    interestFilter,
    languageFilter,
    preferredLevel,
    preferredRegion,
    readingHistoryStoryIds,
    savedBookIds,
    savedStoryIds,
  ]);

  useEffect(() => {
    if (storiesForHome.length === 0) return;

    const unresolved = storiesForHome.filter((story) => {
      const key = `${story.bookSlug}:${story.storySlug}`;
      return (
        !(typeof latestStoryDurations[key] === "number" && latestStoryDurations[key] > 0) &&
        hasAudioSource(story.bookSlug, story.storySlug, story.audioUrl)
      );
    });
    if (unresolved.length === 0) return;

    let cancelled = false;

    const loadDuration = (story: LatestStory) =>
      new Promise<{ key: string; durationSec?: number }>((resolve) => {
        const key = `${story.bookSlug}:${story.storySlug}`;
        if (story.bookSlug === "standalone") {
          const rawSrc = typeof story.audioUrl === "string" ? story.audioUrl.trim() : "";
          if (!rawSrc) {
            resolve({ key });
            return;
          }

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

          audio.src = rawSrc;
          return;
        }

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
  }, [recommendedStories, recommendedStoryDurations]);

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
        region: story.region ?? book.region,
        level: story.level ?? book.level,
        topic: story.topic ?? book.topic,
      };
    }
    return null;
  }, [plan, featuredDaySlug, featuredWeekSlug]);

  const signInHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("redirect_url", "/");
    return `/sign-in?${params.toString()}`;
  }, []);

  const dailyLoop = useMemo(() => {
    const primaryContinue = continueListening[0] ?? null;
<<<<<<< HEAD
    const nextStory: DailyLoopStory | null = !isPersonalizationSettled
      ? null
      : recommendedStories[0]
      ? {
          href: withReturnContext(
            `/books/${recommendedStories[0].bookSlug}/${recommendedStories[0].storySlug}`
          ),
          title: recommendedStories[0].storyTitle,
          label: recommendedStories[0].reason,
          detail: `${recommendedStories[0].language ?? "Story"} · ${
            recommendedStories[0].region ?? "New region"
          }`,
        }
      : polyglotForHome[0]
        ? {
            href: withReturnContext(`/stories/${polyglotForHome[0].slug}`),
            title: polyglotForHome[0].title,
            label: "Explore a new voice",
            detail: `${polyglotForHome[0].language ?? "Polyglot"} · ${
              polyglotForHome[0].region ?? "New region"
            }`,
          }
        : null;
=======
    const nextStory: DailyLoopStory | null = polyglotForHome[0]
      ? {
          href: withReturnContext(`/stories/${polyglotForHome[0].slug}`),
          title: polyglotForHome[0].title,
          label: "Explore a new voice",
          detail: `${polyglotForHome[0].language ?? "Polyglot"} · ${
            polyglotForHome[0].region ?? "New region"
          }`,
        }
      : null;
>>>>>>> feature/revision

    const primary = primaryContinue
      ? {
          eyebrow: "Pick up where you left off",
          title: primaryContinue.title,
          subtitle: `${primaryContinue.bookTitle} · ${formatRemainingDuration(
            primaryContinue.audioDurationSec,
            primaryContinue.progressSec
          )}`,
          href: withReturnContext(`/books/${primaryContinue.bookSlug}/${primaryContinue.storySlug}`),
          cta: "Continue story",
        }
      : featuredFreeStory
        ? {
            eyebrow: featuredFreeStory.label,
            title: featuredFreeStory.title,
            subtitle: `${featuredFreeStory.bookTitle} · ${formatTopic(featuredFreeStory.topic)}`,
            href: featuredFreeStory.href,
            cta: "Start today's story",
          }
        : {
            eyebrow: "Daily reading loop",
            title: "Read one short story today",
            subtitle: "Keep the habit alive in a few minutes.",
            href: "/explore",
            cta: "Explore stories",
          };

    return {
      primary,
<<<<<<< HEAD
      practiceHref: userId ? "/favorites" : signInHref,
      practiceLabel: !isPersonalizationSettled
        ? "Preparing your practice"
        : favoriteSignals.length > 0
          ? "Practice your saved words"
          : "Start saving words",
      practiceDetail:
        !isPersonalizationSettled
          ? "Loading your due words and next step"
          : favoriteSignals.length > 0
          ? `${Math.min(5, favoriteSignals.length)} quick words to review today`
          : "Tap words while reading so they build up here",
      progressHref: userId ? "/progress" : "/explore",
      progressLabel: userId ? "Protect your streak" : "Build your reading habit",
      progressDetail: userId
        ? "One finished story is enough to keep momentum"
        : "Short daily reading works better than long sessions",
      nextStory,
      showLoadingSecondary: !isPersonalizationSettled,
    };
  }, [
    continueListening,
    favoriteSignals.length,
    featuredFreeStory,
    isPersonalizationSettled,
    polyglotForHome,
    recommendedStories,
    signInHref,
    userId,
=======
      practiceHref: hasSession ? "/favorites" : signInHref,
      practiceLabel: hasSession ? "Open your practice" : "Start saving words",
      practiceDetail:
        hasSession
          ? "Review due words and saved expressions"
          : "Tap words while reading so they build up here",
      progressHref: hasSession ? "/progress" : "/explore",
      progressLabel: hasSession ? "Protect your streak" : "Build your reading habit",
      progressDetail: hasSession
        ? "One finished story is enough to keep momentum"
        : "Short daily reading works better than long sessions",
      nextStory,
    };
  }, [
    continueListening,
    featuredFreeStory,
    hasSession,
    polyglotForHome,
    signInHref,
>>>>>>> feature/revision
  ]);

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
          region: s.region ?? storyMeta?.region ?? bookMeta?.region,
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
      className="flex flex-col bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] border border-[var(--card-border)] transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
    >
      <div className="w-full h-48 bg-[color:var(--surface)]">
        <img
          src={item.cover}
          alt={item.title}
          className="object-cover w-full h-full"
        />
      </div>

      <div className="p-5 flex flex-col flex-1 text-left">
        <div>
          {options?.recommendation ? (
            <p className="inline-flex text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground)] bg-[var(--chip-bg)] border border-[var(--chip-border)] rounded-full px-2 py-0.5 mb-2">
              {options.reason ?? "Recommended"}
            </p>
          ) : null}
          <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] line-clamp-2">
            {item.title}
          </h3>
          <p className="text-[var(--primary)] text-sm leading-relaxed line-clamp-1">
            {item.bookTitle}
          </p>
        </div>

        <div className="mt-3 text-sm text-[var(--muted)] space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge level={item.level} />
            <LanguageBadge language={item.language} />
            <RegionBadge region={item.region} />
          </div>
          <p>
            {formatRemainingDuration(item.audioDurationSec, item.progressSec)} ·{" "}
            {formatTopic(item.topic)}
          </p>
        </div>
      </div>
    </Link>
  );

  return (
    <div className="min-h-full w-full flex flex-col items-center px-8 pb-28">
      <>
      <section className="w-full max-w-5xl pt-8 md:pt-10 mb-10 md:mb-12">
        <div className="rounded-[28px] border border-[#2b4767] bg-[linear-gradient(180deg,#173250_0%,#112742_100%)] p-5 shadow-[0_20px_60px_rgba(6,17,38,0.32)] sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200/75">
                Daily loop
              </p>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8dc7ff]">
                {dailyLoop.primary.eyebrow}
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--foreground)] sm:text-4xl">
                {dailyLoop.primary.title}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200/88 sm:text-base">
                {dailyLoop.primary.subtitle}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={dailyLoop.primary.href}
                  className="inline-flex items-center rounded-xl bg-[#4aa8ff] px-4 py-2.5 text-sm font-semibold text-[#071321] transition hover:bg-[#79c0ff]"
                >
                  {dailyLoop.primary.cta}
                </Link>
                <Link
                  href={dailyLoop.progressHref}
                  className="inline-flex items-center rounded-xl border border-white/12 bg-white/6 px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/10"
                >
                  {dailyLoop.progressLabel}
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              <Link
                href={dailyLoop.practiceHref}
                className="rounded-[22px] border border-white/10 bg-white/5 p-4 transition hover:bg-white/8"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200/72">
                  Quick practice
                </p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                  {dailyLoop.practiceLabel}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-300/90">
                  {dailyLoop.practiceDetail}
                </p>
              </Link>

<<<<<<< HEAD
              {dailyLoop.showLoadingSecondary ? (
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200/72">
                    Preparing your next step
                  </p>
                  <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-white/10" />
                  <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-white/10" />
                </div>
              ) : dailyLoop.nextStory ? (
=======
              {dailyLoop.nextStory ? (
>>>>>>> feature/revision
                <Link
                  href={dailyLoop.nextStory.href}
                  className="rounded-[22px] border border-white/10 bg-white/5 p-4 transition hover:bg-white/8"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200/72">
                    {dailyLoop.nextStory.label}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                    {dailyLoop.nextStory.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-300/90">
                    {dailyLoop.nextStory.detail}
                  </p>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Free featured story for free/basic users */}
      {isPersonalizationReady && featuredFreeStory && continueListening.length === 0 && (
        <section className="w-full max-w-5xl text-center pt-8 md:pt-10 mb-10 md:mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--primary)] mb-3">
            {featuredFreeStory.label}
          </p>
          <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">Your free story</h2>
          <div className="max-w-[520px] mx-auto">
            <Link
              href={featuredFreeStory.href}
              className="flex flex-col bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] border border-[var(--card-border)] transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
            >
              <div className="w-full aspect-[16/10] bg-[color:var(--surface)]">
                <img
                  src={featuredFreeStory.cover}
                  alt={featuredFreeStory.title}
                  className="object-contain w-full h-full"
                />
              </div>
              <div className="p-5 flex flex-col flex-1 text-left">
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] line-clamp-2">
                    {featuredFreeStory.title}
                  </h3>
                  <p className="text-[var(--primary)] text-sm leading-relaxed line-clamp-1">
                    {featuredFreeStory.bookTitle}
                  </p>
                </div>
                <div className="mt-3 text-sm text-[var(--muted)] space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <LevelBadge level={featuredFreeStory.level} />
                    <LanguageBadge language={featuredFreeStory.language} />
                    <RegionBadge region={featuredFreeStory.region} />
                  </div>
                  <p>{formatTopic(featuredFreeStory.topic)}</p>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Continue listening */}
      {isPersonalizationReady && continueListening.length > 0 && (
        <section className="w-full max-w-5xl text-center pt-8 md:pt-10 mb-10 md:mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">Continue listening</h2>

          <div className="md:hidden">
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
              <div>
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
        <section className="w-full max-w-5xl text-center mb-10 md:mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--primary)] mb-3">
            {featuredFreeStory.label}
          </p>
          <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">Your free story</h2>
          <div className="max-w-[520px] mx-auto">
            <Link
              href={featuredFreeStory.href}
              className="flex flex-col bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] border border-[var(--card-border)] transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
            >
              <div className="w-full aspect-[16/10] bg-[color:var(--surface)]">
                <img
                  src={featuredFreeStory.cover}
                  alt={featuredFreeStory.title}
                  className="object-contain w-full h-full"
                />
              </div>
              <div className="p-5 flex flex-col flex-1 text-left">
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] line-clamp-2">
                    {featuredFreeStory.title}
                  </h3>
                  <p className="text-[var(--primary)] text-sm leading-relaxed line-clamp-1">
                    {featuredFreeStory.bookTitle}
                  </p>
                </div>
                <div className="mt-3 text-sm text-[var(--muted)] space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <LevelBadge level={featuredFreeStory.level} />
                    <LanguageBadge language={featuredFreeStory.language} />
                    <RegionBadge region={featuredFreeStory.region} />
                  </div>
                  <p>{formatTopic(featuredFreeStory.topic)}</p>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {canShowPersonalizedRecommendations && recommendedStories.length > 0 && (
        <section className="mb-10 md:mb-12 text-center w-full max-w-5xl">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--primary)] mb-2">
              Premium personalization
            </p>
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Recommended for you</h2>
          </div>

          <div>
            <StoryCarousel
              items={recommendedStories}
              renderItem={(story) => (
                <Link
                  key={story.key}
                  href={withReturnContext(`/books/${story.bookSlug}/${story.storySlug}`)}
                  className="flex flex-col bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] border border-[var(--card-border)] transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
                >
                  <div className="w-full h-48 bg-[color:var(--surface)]">
                    <img
                      src={story.coverUrl}
                      alt={story.storyTitle}
                      className="object-cover w-full h-full"
                    />
                  </div>

                  <div className="p-5 flex flex-col flex-1 text-left">
                    <div>
                      <p className="inline-flex text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground)] bg-[var(--chip-bg)] border border-[var(--chip-border)] rounded-full px-2 py-0.5 mb-2">
                        {story.reason}
                      </p>
                      <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] line-clamp-2">
                        {story.storyTitle}
                      </h3>
                      <p className="text-[var(--primary)] text-sm leading-relaxed line-clamp-1">
                        {story.bookTitle}
                      </p>
                    </div>

                    <div className="mt-3 text-sm text-[var(--muted)] space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <LevelBadge level={story.level} />
                        <LanguageBadge language={story.language} />
                        <RegionBadge region={story.region} />
                      </div>
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
      <section className="mb-10 md:mb-12 text-center w-full max-w-5xl">
        <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">Latest Books</h2>

        <div className="md:hidden">
          <StoryCarousel
            items={filteredBooks.slice(0, MOBILE_LIMIT)}
            mobileItemClassName="w-[82%] sm:w-[62%]"
            renderItem={(book) => (
              <BookHorizontalCard
                key={book.slug}
                href={`/books/${book.slug}?from=home`}
                title={book.title}
                cover={book.cover}
                level={book.level}
                language={book.language}
                region={book.region}
                statsLine={bookMetaBySlug.get(book.slug)?.statsLine}
                topicsLine={bookMetaBySlug.get(book.slug)?.topicsLine}
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
                level={book.level}
                language={book.language}
                region={book.region}
                statsLine={bookMetaBySlug.get(book.slug)?.statsLine}
                topicsLine={bookMetaBySlug.get(book.slug)?.topicsLine}
                description={book.description}
                href={`/books/${book.slug}?from=home`}
              />
            )}
          />
        </div>
      </section>

      {/* Latest Stories */}
      <section className="mb-10 md:mb-12 text-center w-full max-w-5xl">
        <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">Latest Stories</h2>

        <div>
          <StoryCarousel
            items={latestHomeStories}
            renderItem={(story) => {
              return (
              <Link
                key={story.key}
                href={story.href}
                className="flex flex-col bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] border border-[var(--card-border)] transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
              >
                <div className="w-full h-48 bg-[color:var(--surface)]">
                  <img
                    src={story.coverUrl}
                    alt={story.title}
                    className="object-cover w-full h-full"
                  />
                </div>

                <div className="p-5 flex flex-col flex-1 text-left">
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] line-clamp-2">
                      {story.title}
                    </h3>
                    <p className="text-[var(--primary)] text-sm leading-relaxed line-clamp-1">
                      {story.subtitle}
                    </p>
                  </div>

                  <div className="mt-3 text-sm text-[var(--muted)] space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <LevelBadge level={story.level} />
                      <LanguageBadge language={story.language} />
                      <RegionBadge region={story.region} />
                    </div>
                    <p>{story.detail}</p>
                  </div>
                </div>
              </Link>
              );
            }}
          />
        </div>

        <div className="md:hidden mt-4 text-[var(--muted)] text-sm">
          Showing {Math.min(MOBILE_LIMIT, latestHomeStories.length)} of {latestHomeStories.length}
        </div>
      </section>
      </>
    </div>
  );
}
