'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { formatLanguageCode } from '@/lib/displayFormat';
import { formatLanguage, formatLevel, formatTopic } from '@/lib/displayFormat';
import { books } from '@/data/books';
import { getBookCardMeta } from '@/lib/bookCardMeta';
import StoryCarousel from '@/components/StoryCarousel';
import ReleaseCarousel from '@/components/ReleaseCarousel';
import BookHorizontalCard from '@/components/BookHorizontalCard';
import StoryVerticalCard from '@/components/StoryVerticalCard';
import {
  VOCAB_TYPE_ORDER,
  VocabTypeKey,
  getVocabTypeLabel,
  normalizeVocabType,
} from '@/lib/vocabTypes';

type FavoriteItem = {
  word: string;
  translation: string;
  wordType?: string | null;
  exampleSentence?: string | null;
  storySlug?: string | null;
  storyTitle?: string | null;
  sourcePath?: string | null;
  language?: string | null;
  nextReviewAt?: string | null;
  lastReviewedAt?: string | null;
  streak?: number | null;
};
type ReviewScore = 'again' | 'hard' | 'easy';
type SrsMeta = {
  nextReviewAt: number;
  lastReviewedAt?: number;
  streak: number;
};
type SrsMap = Record<string, SrsMeta>;
type SuggestedBook = {
  slug: string;
  title: string;
  language?: string;
  region?: string;
  level?: string;
  cover?: string;
  description?: string;
  statsLine?: string;
  topicsLine?: string;
};
type SuggestedStory = {
  id: string;
  bookSlug: string;
  storySlug: string;
  title: string;
  bookTitle: string;
  language: string;
  region?: string;
  level: string;
  topic?: string;
  coverUrl?: string;
};

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function getFavoriteType(fav: FavoriteItem): VocabTypeKey {
  return (
    normalizeVocabType(fav.wordType, {
      word: fav.word,
      definition: fav.translation,
    }) ?? 'other'
  );
}

function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function normalizeTokenValue(value?: string | null): string | null {
  if (!value) return null;
  const clean = value.trim().toLowerCase();
  return clean.length > 0 ? clean : null;
}

function areWordsRelated(a: FavoriteItem, b: FavoriteItem): boolean {
  const typeA = getFavoriteType(a);
  const typeB = getFavoriteType(b);
  if (typeA === typeB) return true;

  const storyA = normalizeTokenValue(a.storySlug);
  const storyB = normalizeTokenValue(b.storySlug);
  if (storyA && storyB && storyA === storyB) return true;

  const langA = normalizeTokenValue(a.language);
  const langB = normalizeTokenValue(b.language);
  if (langA && langB && langA === langB) return true;

  return false;
}

function mergeFavoriteItem(remote: FavoriteItem, local: FavoriteItem): FavoriteItem {
  const pickString = (
    preferred?: string | null,
    fallback?: string | null
  ): string | null | undefined => {
    const a = typeof preferred === 'string' ? preferred.trim() : '';
    if (a) return preferred;
    const b = typeof fallback === 'string' ? fallback.trim() : '';
    if (b) return fallback;
    return preferred ?? fallback ?? undefined;
  };

  return {
    ...remote,
    translation: pickString(remote.translation, local.translation) ?? '',
    wordType: pickString(remote.wordType, local.wordType) ?? null,
    exampleSentence: pickString(remote.exampleSentence, local.exampleSentence) ?? null,
    storySlug: pickString(remote.storySlug, local.storySlug) ?? null,
    storyTitle: pickString(remote.storyTitle, local.storyTitle) ?? null,
    sourcePath: pickString(remote.sourcePath, local.sourcePath) ?? null,
    language: pickString(remote.language, local.language) ?? null,
  };
}

function getSrsKey(userId?: string): string {
  return `dp_favorites_srs_${userId ?? 'guest'}`;
}

function getFavoritesCacheKey(userId?: string): string {
  return `dp_favorites_${userId ?? 'guest'}`;
}

function loadFavoritesCache(userId?: string): FavoriteItem[] {
  try {
    const userScoped = localStorage.getItem(getFavoritesCacheKey(userId));
    if (userScoped) return JSON.parse(userScoped) as FavoriteItem[];
    const legacy = localStorage.getItem('favorites');
    return legacy ? (JSON.parse(legacy) as FavoriteItem[]) : [];
  } catch {
    return [];
  }
}

function saveFavoritesCache(userId: string | undefined, items: FavoriteItem[]) {
  try {
    localStorage.setItem(getFavoritesCacheKey(userId), JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

function loadSrsMap(userId?: string): SrsMap {
  try {
    const raw = localStorage.getItem(getSrsKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as SrsMap;
  } catch {
    return {};
  }
}

function saveSrsMap(userId: string | undefined, map: SrsMap) {
  try {
    localStorage.setItem(getSrsKey(userId), JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function isDue(meta: SrsMeta | undefined, nowMs: number): boolean {
  if (!meta) return true;
  return meta.nextReviewAt <= nowMs;
}

function computeNextReview(score: ReviewScore, streak: number): { nextReviewAt: number; streak: number } {
  const now = Date.now();
  if (score === 'again') {
    return { nextReviewAt: now + 10 * 60 * 1000, streak: 0 };
  }
  if (score === 'hard') {
    const nextStreak = Math.max(1, streak);
    return { nextReviewAt: now + 24 * 60 * 60 * 1000, streak: nextStreak };
  }
  const nextStreak = streak + 1;
  const days = nextStreak >= 4 ? 14 : nextStreak >= 2 ? 7 : 3;
  return { nextReviewAt: now + days * 24 * 60 * 60 * 1000, streak: nextStreak };
}

function formatNextReview(meta?: SrsMeta): string {
  if (!meta) return 'Due now';
  const diff = meta.nextReviewAt - Date.now();
  if (diff <= 0) return 'Due now';
  const hours = Math.ceil(diff / (1000 * 60 * 60));
  if (hours < 24) return `In ${hours}h`;
  const days = Math.ceil(hours / 24);
  return `In ${days}d`;
}

function normalizeMatch(value?: string | null): string {
  return value?.trim().toLowerCase() ?? '';
}

export default function FavoritesPage() {
  const { user, isLoaded } = useUser();
  const { userId } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [srsMap, setSrsMap] = useState<SrsMap>({});
  const [isReady, setIsReady] = useState(false); // controla visibilidad final
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceModeKind, setPracticeModeKind] = useState<'due' | 'all' | 'related'>('due');
  const [practiceQueue, setPracticeQueue] = useState<FavoriteItem[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [practiceType, setPracticeType] = useState<'all' | VocabTypeKey>('all');
  const allBooks = useMemo(() => Object.values(books), []);
  const targetLanguages = useMemo(
    () =>
      Array.isArray(user?.publicMetadata?.targetLanguages)
        ? (user?.publicMetadata?.targetLanguages as unknown[])
            .filter((value): value is string => typeof value === 'string')
            .map((value) => normalizeMatch(value))
        : [],
    [user]
  );
  const getPracticeModeTabClass = (mode: 'due' | 'all' | 'related') =>
    `px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
      practiceModeKind === mode
        ? "bg-blue-600 text-white"
        : "bg-transparent hover:bg-[var(--card-bg-hover)] text-[var(--foreground)]"
    }`;

  useEffect(() => {
    const load = async () => {
      // 1️⃣ Cargar de localStorage inmediatamente
      const localFavs = loadFavoritesCache(userId ?? undefined);
      setFavorites(localFavs);

      // 2️⃣ Sincronizar backend (en segundo plano)
      if (isLoaded && user) {
        try {
          const res = await fetch('/api/favorites', { cache: 'no-store' });
          const remoteFavs = res.ok ? ((await res.json()) as FavoriteItem[]) : [];
          const localByWord = new Map(localFavs.map((fav) => [normalizeWord(fav.word), fav] as const));
          const mergedRemote = remoteFavs.map((remote) => {
            const local = localByWord.get(normalizeWord(remote.word));
            return local ? mergeFavoriteItem(remote, local) : remote;
          });
          const merged = [
            ...mergedRemote,
            ...localFavs.filter((f) => !remoteFavs.some((r) => normalizeWord(r.word) === normalizeWord(f.word))),
          ];

          await Promise.all(
            localFavs
              .filter((f) => !remoteFavs.some((r) => r.word === f.word))
              .map((fav) =>
                fetch('/api/favorites', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(fav),
                }),
              ),
          );

          localStorage.removeItem('favorites');
          setFavorites(merged);
          saveFavoritesCache(userId ?? undefined, merged);

          const remoteSrs: SrsMap = {};
          for (const fav of remoteFavs) {
            const key = normalizeWord(fav.word);
            if (!key) continue;
            if (!fav.nextReviewAt) continue;
            const parsedNext = new Date(fav.nextReviewAt).getTime();
            if (Number.isNaN(parsedNext)) continue;
            const parsedLast = fav.lastReviewedAt
              ? new Date(fav.lastReviewedAt).getTime()
              : undefined;
            remoteSrs[key] = {
              nextReviewAt: parsedNext,
              lastReviewedAt: parsedLast && !Number.isNaN(parsedLast) ? parsedLast : undefined,
              streak: typeof fav.streak === 'number' ? fav.streak : 0,
            };
          }
          setSrsMap(remoteSrs);
        } catch {
          // no romper UI
        }
      } else {
        const map = loadSrsMap(userId ?? undefined);
        setSrsMap(map);
      }

      // 3️⃣ Mostrar el contenido tras pequeño delay para evitar flicker
      setTimeout(() => setIsReady(true), 250);
    };

    void load();
  }, [user, isLoaded, userId]);

  useEffect(() => {
    const refreshFromCache = () => {
      const cached = loadFavoritesCache(userId ?? undefined);
      setFavorites(cached);
    };
    window.addEventListener('favorites-updated', refreshFromCache);
    window.addEventListener('storage', refreshFromCache);
    return () => {
      window.removeEventListener('favorites-updated', refreshFromCache);
      window.removeEventListener('storage', refreshFromCache);
    };
  }, [userId]);

  useEffect(() => {
    if (!isLoaded) return;
    saveSrsMap(userId ?? undefined, srsMap);
  }, [srsMap, userId, isLoaded]);

  const now = Date.now();
  const dueFavorites = favorites.filter((fav) => isDue(srsMap[normalizeWord(fav.word)], now));
  const currentPractice = practiceQueue[practiceIndex] ?? null;
  const favoriteTypeCounts = favorites.reduce<Record<VocabTypeKey, number>>((acc, fav) => {
    const key = getFavoriteType(fav);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<VocabTypeKey, number>);
  const availablePracticeTypes = VOCAB_TYPE_ORDER.filter((key) => (favoriteTypeCounts[key] ?? 0) > 0);
  const suggestedBooks = useMemo<SuggestedBook[]>(
    () =>
      allBooks
        .map((bookMeta) => ({
          item: {
            slug: bookMeta.slug,
            title: bookMeta.title,
            language:
              typeof bookMeta.language === 'string' ? formatLanguage(bookMeta.language) : undefined,
            region: typeof bookMeta.region === 'string' ? bookMeta.region : undefined,
            level: typeof bookMeta.level === 'string' ? formatLevel(bookMeta.level) : undefined,
            cover: bookMeta.cover,
            description:
              typeof bookMeta.description === 'string' ? bookMeta.description : undefined,
            statsLine: getBookCardMeta(bookMeta).statsLine,
            topicsLine: getBookCardMeta(bookMeta).topicsLine,
          },
          score: targetLanguages.includes(normalizeMatch(bookMeta.language)) ? 2 : 0,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map(({ item }) => item),
    [allBooks, targetLanguages]
  );
  const suggestedStories = useMemo<SuggestedStory[]>(
    () =>
      allBooks
        .flatMap((bookMeta) =>
          bookMeta.stories.map((storyMeta) => {
            const languageValue =
              typeof storyMeta.language === 'string' ? storyMeta.language : bookMeta.language;
            return {
              item: {
                id: `${bookMeta.id}:${storyMeta.id}`,
                bookSlug: bookMeta.slug,
                storySlug: storyMeta.slug,
                title: storyMeta.title,
                bookTitle: bookMeta.title,
                language: formatLanguage(languageValue),
                region:
                  typeof storyMeta.region === 'string' && storyMeta.region.trim() !== ''
                    ? storyMeta.region
                    : bookMeta.region,
                level: formatLevel(
                  typeof storyMeta.level === 'string' ? storyMeta.level : bookMeta.level
                ),
                topic:
                  typeof storyMeta.topic === 'string'
                    ? storyMeta.topic
                    : typeof bookMeta.topic === 'string'
                      ? bookMeta.topic
                      : undefined,
                coverUrl:
                  typeof storyMeta.cover === 'string' && storyMeta.cover.trim() !== ''
                    ? storyMeta.cover
                    : typeof bookMeta.cover === 'string' && bookMeta.cover.trim() !== ''
                      ? bookMeta.cover
                      : '/covers/default.jpg',
              },
              score: targetLanguages.includes(normalizeMatch(languageValue)) ? 2 : 0,
            };
          })
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(({ item }) => item),
    [allBooks, targetLanguages]
  );

  const removeFavorite = async (word: string) => {
    const updated = favorites.filter((f) => f.word !== word);
    setFavorites(updated);
    saveFavoritesCache(userId ?? undefined, updated);
    const key = normalizeWord(word);
    setSrsMap((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

    if (user) {
      await fetch('/api/favorites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });
    } else {
      saveFavoritesCache(undefined, updated);
    }
  };

  const startPractice = (onlyDue: boolean) => {
    const source = onlyDue ? dueFavorites : favorites;
    const snapshot = source.filter((fav) => {
      if (practiceType === 'all') return true;
      const normalized = getFavoriteType(fav);
      return normalized === practiceType;
    });
    setPracticeModeKind(onlyDue ? 'due' : 'all');
    setPracticeQueue(snapshot);
    setPracticeMode(snapshot.length > 0);
    setPracticeIndex(0);
    setRevealed(false);
  };

  const startRelatedPractice = () => {
    const base = favorites.filter((fav) => {
      if (practiceType === 'all') return true;
      return getFavoriteType(fav) === practiceType;
    });

    if (base.length === 0) {
      setPracticeQueue([]);
      setPracticeMode(false);
      setPracticeIndex(0);
      setRevealed(false);
      return;
    }

    const duePool = base.filter((fav) => isDue(srsMap[normalizeWord(fav.word)], now));
    const relatedPool = base.filter((candidate) => {
      const candidateKey = normalizeWord(candidate.word);
      return base.some((seed) => {
        const seedKey = normalizeWord(seed.word);
        if (seedKey === candidateKey) return false;
        return areWordsRelated(seed, candidate);
      });
    });

    const dueRelated = duePool.filter((due) =>
      relatedPool.some((related) => normalizeWord(related.word) === normalizeWord(due.word))
    );

    const dueShuffled = shuffleArray(dueRelated);
    const relatedShuffled = shuffleArray(
      relatedPool.filter(
        (fav) => !dueRelated.some((due) => normalizeWord(due.word) === normalizeWord(fav.word))
      )
    );
    const maxQueue = 20;
    const dueTarget = Math.min(dueShuffled.length, Math.max(4, Math.ceil(maxQueue * 0.5)));
    const relatedTarget = Math.min(relatedShuffled.length, maxQueue - dueTarget);
    const selectedDue = dueShuffled.slice(0, dueTarget);
    const selectedRelated = relatedShuffled.slice(0, relatedTarget);
    const fallback =
      selectedDue.length + selectedRelated.length > 0
        ? []
        : shuffleArray(base).slice(0, Math.min(maxQueue, base.length));

    const relatedSet = shuffleArray([...selectedDue, ...selectedRelated, ...fallback]);

    setPracticeModeKind('related');
    setPracticeQueue(relatedSet);
    setPracticeMode(relatedSet.length > 0);
    setPracticeIndex(0);
    setRevealed(false);
  };

  const rateCurrent = async (score: ReviewScore) => {
    if (!currentPractice) return;
    const key = normalizeWord(currentPractice.word);
    const prev = srsMap[key];
    const next = computeNextReview(score, prev?.streak ?? 0);
    const lastReviewedAt = Date.now();
    setSrsMap((map) => ({
      ...map,
      [key]: {
        nextReviewAt: next.nextReviewAt,
        streak: next.streak,
        lastReviewedAt,
      },
    }));

    if (user) {
      try {
        await fetch('/api/favorites', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: currentPractice.word,
            nextReviewAt: new Date(next.nextReviewAt).toISOString(),
            lastReviewedAt: new Date(lastReviewedAt).toISOString(),
            streak: next.streak,
          }),
        });
      } catch {
        // no romper flujo de estudio
      }
    }

    setRevealed(false);
    const hasNext = practiceIndex + 1 < practiceQueue.length;
    if (hasNext) {
      setPracticeIndex((idx) => idx + 1);
      return;
    }
    setPracticeMode(false);
    setPracticeQueue([]);
    setPracticeIndex(0);
  };

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto text-[var(--foreground)]">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Favorites</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {dueFavorites.length} due today · {favorites.length} total
          </p>
        </div>
        {favorites.length > 0 ? (
          <div className="flex flex-col items-end gap-2">
            <div className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1">
              <button
                onClick={() => startPractice(true)}
                className={getPracticeModeTabClass('due')}
              >
                Practice due
              </button>
              <button
                onClick={() => startPractice(false)}
                className={getPracticeModeTabClass('all')}
              >
                Practice all
              </button>
              <button
                onClick={startRelatedPractice}
                className={getPracticeModeTabClass('related')}
              >
                Practice related
              </button>
            </div>
            <div className="flex max-w-full flex-wrap justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setPracticeType('all')}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  practiceType === 'all'
                    ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                    : 'border-[var(--chip-border)] bg-[var(--chip-bg)] text-[var(--chip-text)]'
                }`}
              >
                All types
              </button>
              {availablePracticeTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPracticeType(type)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    practiceType === type
                      ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                      : 'border-[var(--chip-border)] bg-[var(--chip-bg)] text-[var(--chip-text)]'
                  }`}
                >
                  {getVocabTypeLabel(type)} ({favoriteTypeCounts[type] ?? 0})
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {practiceMode && currentPractice ? (
        <div className="mb-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)] mb-2">
            Practice {practiceIndex + 1}/{practiceQueue.length}
            {practiceType !== 'all' ? ` · ${getVocabTypeLabel(practiceType)}` : ''}
            {practiceModeKind === 'related'
              ? ' · Related'
              : practiceModeKind === 'due'
                ? ' · Due'
                : ' · All'}
          </p>
          <p className="text-3xl font-semibold mb-4">{currentPractice.word}</p>
          <div className="mb-3">
            <span className="rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-2 py-0.5 text-[11px] text-[var(--chip-text)]">
              {getVocabTypeLabel(
                normalizeVocabType(currentPractice.wordType, {
                  word: currentPractice.word,
                  definition: currentPractice.translation,
                }) ?? 'other'
              )}
            </span>
          </div>
          {revealed ? (
            <>
              <p className="text-lg text-[var(--foreground)]/92 mb-4">{currentPractice.translation}</p>
              {currentPractice.exampleSentence ? (
                <p className="text-sm text-[var(--muted)] mb-4 italic border-l-2 border-[var(--card-border)] pl-3">
                  {currentPractice.exampleSentence}
                </p>
              ) : null}
              {currentPractice.sourcePath ? (
                <a
                  href={currentPractice.sourcePath}
                  className="inline-flex mb-4 text-sm text-[var(--primary)] hover:opacity-85"
                >
                  Open story
                </a>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => rateCurrent('again')}
                  className="px-3 py-2 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                >
                  Again
                </button>
                <button
                  onClick={() => rateCurrent('hard')}
                  className="px-3 py-2 rounded-lg bg-amber-600/90 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
                >
                  Hard
                </button>
                <button
                  onClick={() => rateCurrent('easy')}
                  className="px-3 py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
                >
                  Easy
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setRevealed(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              Reveal answer
            </button>
          )}
        </div>
      ) : null}

      {/* Contenedor estructural fijo */}
      <div className="relative min-h-[200px]">
        {/* Skeleton visible hasta que isReady sea true */}
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${
            isReady ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={`fav-skeleton-${idx}`}
                className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 animate-pulse"
              >
                <div className="h-5 w-40 rounded bg-[var(--card-bg-hover)] mb-2" />
                <div className="h-4 w-11/12 rounded bg-[var(--card-bg-hover)] mb-2" />
                <div className="h-4 w-9/12 rounded bg-[var(--card-bg-hover)] mb-3" />
                <div className="h-3 w-24 rounded bg-[var(--card-bg-hover)]" />
              </div>
            ))}
          </div>
        </div>

        {/* Contenido real debajo */}
        <div
          className={`transition-opacity duration-700 ${
            isReady ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {favorites.length === 0 ? (
            <div className="space-y-8">
              <div>
                <p className="text-[var(--muted)]">No favorites saved yet.</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Save words from stories to review them later, or start with something worth reading below.
                </p>
              </div>

              {suggestedStories.length > 0 ? (
                <section>
                  <h2 className="mb-3 text-lg font-semibold text-[var(--foreground)]">
                    Suggested stories
                  </h2>
                  <StoryCarousel<SuggestedStory>
                    items={suggestedStories}
                    renderItem={(story) => (
                      <StoryVerticalCard
                        href={`/books/${story.bookSlug}/${story.storySlug}?from=favorites`}
                        title={story.title}
                        coverUrl={story.coverUrl || '/covers/default.png'}
                        subtitle={story.bookTitle}
                        level={story.level}
                        language={story.language}
                        region={story.region}
                        metaSecondary={formatTopic(story.topic)}
                      />
                    )}
                  />
                </section>
              ) : null}

              {suggestedBooks.length > 0 ? (
                <section>
                  <h2 className="mb-3 text-lg font-semibold text-[var(--foreground)]">
                    Suggested books
                  </h2>
                  <ReleaseCarousel
                    items={suggestedBooks}
                    itemClassName="md:flex-[0_0_46%] lg:flex-[0_0_46%] xl:flex-[0_0_46%]"
                    renderItem={(book) => (
                      <BookHorizontalCard
                        href={`/books/${book.slug}?from=favorites`}
                        title={book.title}
                        cover={book.cover}
                        level={book.level}
                        language={book.language}
                        region={book.region}
                        statsLine={book.statsLine}
                        topicsLine={book.topicsLine}
                        description={book.description}
                      />
                    )}
                  />
                </section>
              ) : null}
            </div>
          ) : (
            <ul className="space-y-4">
              {favorites.map((fav) => {
                const meta = srsMap[normalizeWord(fav.word)];
                const due = isDue(meta, now);
                return (
                <li
                  key={fav.word}
                  className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-4 sm:p-5 shadow-[0_12px_28px_rgba(2,8,23,0.18)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-2xl leading-tight">{fav.word}</p>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] text-[var(--chip-text)]">
                          {getVocabTypeLabel(
                            normalizeVocabType(fav.wordType, {
                              word: fav.word,
                              definition: fav.translation,
                            }) ?? 'other'
                          )}
                        </span>
                        {fav.language ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] text-[var(--chip-text)]">
                            {formatLanguageCode(fav.language)}
                          </span>
                        ) : null}
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          due
                            ? 'border-emerald-500/40 bg-emerald-500/18 text-[var(--foreground)] font-medium'
                            : 'border-[var(--chip-border)] bg-[var(--chip-bg)] text-[var(--chip-text)]'
                        }`}
                      >
                        {due ? 'Due today' : formatNextReview(meta)}
                      </span>
                      </div>
                      <p className="text-[var(--foreground)] text-[1.03rem] leading-relaxed mt-1 line-clamp-2">
                        {fav.translation}
                      </p>
                      {fav.exampleSentence ? (
                        <p className="text-[0.98rem] text-[var(--muted)] mt-1.5 line-clamp-2 italic">
                          {fav.exampleSentence}
                        </p>
                      ) : null}
                      <div className="mt-3 flex items-center gap-2">
                      {fav.sourcePath ? (
                        <a
                          href={fav.sourcePath}
                          className="text-sm text-[var(--primary)] hover:opacity-85 transition-colors"
                        >
                          Open story
                        </a>
                      ) : null}
                    </div>
                    </div>
                    <button
                      onClick={() => removeFavorite(fav.word)}
                      aria-label={`Remove ${fav.word}`}
                      className="shrink-0 rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] p-2 text-[var(--muted)] hover:text-red-400 hover:border-red-400/30 hover:bg-red-500/10 transition-colors"
                      title="Remove"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0H7m3-3h4a1 1 0 011 1v1H8V5a1 1 0 011-1z"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              )})}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
