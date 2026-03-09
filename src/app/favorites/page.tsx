'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { books } from '@/data/books';
import { formatLanguageCode } from '@/lib/displayFormat';
import {
  VOCAB_TYPE_ORDER,
  VocabTypeKey,
  getVocabTypeLabel,
  normalizeVocabType,
} from '@/lib/vocabTypes';

const MIN_RELATED_PRACTICE_ITEMS = 3;
const RELATED_PRACTICE_MAX = 20;
const RELATED_DEFINITION_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'be',
  'by',
  'de',
  'del',
  'der',
  'die',
  'el',
  'en',
  'for',
  'from',
  'in',
  'la',
  'las',
  'los',
  'mit',
  'of',
  'on',
  'or',
  'the',
  'to',
  'un',
  'una',
  'und',
  'with',
]);

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

function getDefinitionTokens(value?: string | null): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .split(/[^a-záéíóúüñäöß]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !RELATED_DEFINITION_STOPWORDS.has(token));
}

function getWordStem(value: string): string {
  const normalized = normalizeWord(value).replace(/[^a-záéíóúüñäöß]+/gi, '');
  return normalized.slice(0, 5);
}

function getFavoriteIdentity(item: Pick<FavoriteItem, 'word' | 'language'>): string {
  return `${normalizeWord(item.word)}::${normalizeTokenValue(item.language) ?? ''}`;
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
  const [practiceScoresByKey, setPracticeScoresByKey] = useState<Record<string, ReviewScore>>({});
  const [revealedPracticeKeys, setRevealedPracticeKeys] = useState<string[]>([]);
  const [practiceType, setPracticeType] = useState<'all' | VocabTypeKey>('all');
  const getPracticeModeTabClass = (mode: 'due' | 'all' | 'related') =>
    `px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
      practiceModeKind === mode
        ? "bg-blue-600 text-white"
        : "bg-transparent hover:bg-[var(--card-bg-hover)] text-[var(--foreground)]"
    }`;

  useEffect(() => {
    let cancelled = false;
    let readyTimer: number | undefined;

    const load = async () => {
      if (!isLoaded) {
        setIsReady(false);
        return;
      }

      if (!user) {
        if (!cancelled) {
          setFavorites([]);
          setSrsMap({});
        }
        readyTimer = window.setTimeout(() => {
          if (!cancelled) {
            setIsReady(true);
          }
        }, 250);
        return;
      }

      const scopedUserId = user?.id ?? userId ?? undefined;

      // 1️⃣ Cargar de localStorage inmediatamente
      const localFavs = loadFavoritesCache(scopedUserId);
      if (!cancelled) {
        setFavorites(localFavs);
      }

      // 2️⃣ Sincronizar backend (en segundo plano)
      if (user) {
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
          if (!cancelled) {
            setFavorites(merged);
          }
          saveFavoritesCache(scopedUserId, merged);

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
          if (!cancelled) {
            setSrsMap(remoteSrs);
          }
        } catch {
          // no romper UI
        }
      } else {
        const map = loadSrsMap(scopedUserId);
        if (!cancelled) {
          setSrsMap(map);
        }
      }

      // 3️⃣ Mostrar el contenido tras pequeño delay para evitar flicker
      readyTimer = window.setTimeout(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      }, 250);
    };

    void load();

    return () => {
      cancelled = true;
      if (typeof readyTimer === 'number') {
        window.clearTimeout(readyTimer);
      }
    };
  }, [user, isLoaded, userId]);

  useEffect(() => {
    const refreshFromCache = () => {
      if (!user) {
        setFavorites([]);
        return;
      }
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
  const currentPracticeIdentity = currentPractice ? getFavoriteIdentity(currentPractice) : null;
  const currentPracticeKey =
    currentPracticeIdentity ? `${currentPracticeIdentity}::${practiceIndex}` : null;
  const revealed = currentPracticeKey ? revealedPracticeKeys.includes(currentPracticeKey) : false;
  const practiceScore = currentPracticeKey ? practiceScoresByKey[currentPracticeKey] ?? null : null;
  const favoriteIdentitySet = useMemo(
    () => new Set(favorites.map((fav) => getFavoriteIdentity(fav))),
    [favorites]
  );
  const allCatalogRelatedItems = useMemo<FavoriteItem[]>(() => {
    const items: FavoriteItem[] = [];

    for (const book of Object.values(books)) {
      for (const story of book.stories ?? []) {
        for (const vocab of story.vocab ?? []) {
          if (!vocab.word || !vocab.definition) continue;
          items.push({
            word: vocab.word,
            translation: vocab.definition,
            wordType:
              normalizeVocabType(vocab.type, {
                word: vocab.word,
                definition: vocab.definition,
              }) ?? null,
            exampleSentence: typeof vocab.note === 'string' ? vocab.note : null,
            storySlug: story.slug,
            storyTitle: story.title,
            sourcePath: `/books/${book.slug}/${story.slug}`,
            language: story.language ?? book.language ?? null,
          });
        }
      }
    }

    return items;
  }, []);
  const favoriteTypeCounts = favorites.reduce<Record<VocabTypeKey, number>>((acc, fav) => {
    const key = getFavoriteType(fav);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<VocabTypeKey, number>);
  const availablePracticeTypes = VOCAB_TYPE_ORDER.filter((key) => (favoriteTypeCounts[key] ?? 0) > 0);
  const relatedPracticeCandidates = useMemo(() => {
    const base = favorites.filter((fav) => {
      if (practiceType === 'all') return true;
      return getFavoriteType(fav) === practiceType;
    });

    if (base.length === 0) return [];

    const scored = new Map<string, { item: FavoriteItem; score: number }>();

    for (const seed of base) {
      const seedLanguage = normalizeTokenValue(seed.language);
      const seedStory = normalizeTokenValue(seed.storySlug);
      const seedType = getFavoriteType(seed);
      const seedDefinitionTokens = new Set(getDefinitionTokens(seed.translation));
      const seedStem = getWordStem(seed.word);

      for (const candidate of allCatalogRelatedItems) {
        const candidateLanguage = normalizeTokenValue(candidate.language);
        if (!seedLanguage || candidateLanguage !== seedLanguage) continue;
        if (favoriteIdentitySet.has(getFavoriteIdentity(candidate))) continue;
        if (seedStory && normalizeTokenValue(candidate.storySlug) === seedStory) continue;

        const candidateType = getFavoriteType(candidate);
        const candidateTokens = getDefinitionTokens(candidate.translation);
        const sharedDefinitionTokens = candidateTokens.filter((token) => seedDefinitionTokens.has(token));
        const candidateStem = getWordStem(candidate.word);

        let score = 0;
        if (candidateType === seedType) score += 3;
        if (sharedDefinitionTokens.length > 0) score += Math.min(4, sharedDefinitionTokens.length * 2);
        if (seedStem.length >= 4 && candidateStem.length >= 4 && seedStem === candidateStem) score += 2;

        if (score < 4) continue;

        const key = `${getFavoriteIdentity(candidate)}::${normalizeTokenValue(candidate.storySlug) ?? ''}`;
        const existing = scored.get(key);
        if (!existing || score > existing.score) {
          scored.set(key, { item: candidate, score });
        }
      }
    }

    return [...scored.values()]
      .sort((a, b) => b.score - a.score || a.item.word.localeCompare(b.item.word))
      .slice(0, RELATED_PRACTICE_MAX)
      .map((entry) => entry.item);
  }, [allCatalogRelatedItems, favoriteIdentitySet, favorites, practiceType]);
  const relatedPracticeAvailable = relatedPracticeCandidates.length >= MIN_RELATED_PRACTICE_ITEMS;

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

  const saveRelatedFavorite = async (item: FavoriteItem) => {
    const identity = getFavoriteIdentity(item);
    if (favoriteIdentitySet.has(identity)) return;

    const updated = [...favorites, item];
    setFavorites(updated);
    saveFavoritesCache(userId ?? undefined, updated);

    try {
      if (user) {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
        if (!res.ok) throw new Error('Network error');
      } else {
        saveFavoritesCache(undefined, updated);
      }
    } catch (err) {
      console.error('Error saving related favorite:', err);
    }
  };

  const removeRelatedFavorite = async (item: FavoriteItem) => {
    const identity = getFavoriteIdentity(item);
    const updated = favorites.filter((fav) => getFavoriteIdentity(fav) !== identity);
    setFavorites(updated);
    saveFavoritesCache(userId ?? undefined, updated);

    try {
      if (user) {
        await fetch('/api/favorites', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: item.word }),
        });
      } else {
        saveFavoritesCache(undefined, updated);
      }
    } catch (err) {
      console.error('Error removing related favorite:', err);
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
    setPracticeScoresByKey({});
    setRevealedPracticeKeys([]);
  };

  const startRelatedPractice = () => {
    if (relatedPracticeCandidates.length < MIN_RELATED_PRACTICE_ITEMS) {
      setPracticeQueue([]);
      setPracticeMode(false);
      setPracticeIndex(0);
      setRevealedPracticeKeys([]);
      return;
    }
    const relatedSet = shuffleArray(relatedPracticeCandidates);

    setPracticeModeKind('related');
    setPracticeQueue(relatedSet);
    setPracticeMode(relatedSet.length > 0);
    setPracticeIndex(0);
    setPracticeScoresByKey({});
    setRevealedPracticeKeys([]);
  };

  const rateCurrent = async (score: ReviewScore) => {
    if (!currentPractice) return;
    const isSavedFavorite = favoriteIdentitySet.has(getFavoriteIdentity(currentPractice));

    if (practiceModeKind === 'related') {
      if (currentPracticeKey) {
        setPracticeScoresByKey((map) => ({ ...map, [currentPracticeKey]: score }));
      }
      if (!isSavedFavorite) {
        return;
      }
    }

    if (!isSavedFavorite && practiceModeKind === 'related') {
      return;
    }

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

  };

  const finishPractice = () => {
    setPracticeMode(false);
    setPracticeQueue([]);
    setPracticeIndex(0);
    setPracticeScoresByKey({});
    setRevealedPracticeKeys([]);
  };

  const goToNextPractice = () => {
    if (!currentPractice) return;

    const shouldRepeat = practiceModeKind === 'related' && (practiceScore === 'again' || practiceScore === 'hard');
    const repeatedQueue = shouldRepeat ? [...practiceQueue, currentPractice] : practiceQueue;
    const hasNext = practiceIndex + 1 < repeatedQueue.length;

    setPracticeQueue(repeatedQueue);

    if (hasNext) {
      setPracticeIndex((idx) => idx + 1);
      return;
    }

    finishPractice();
  };

  const goToPreviousPractice = () => {
    if (practiceIndex === 0) return;
    setPracticeIndex((idx) => Math.max(0, idx - 1));
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
              {relatedPracticeAvailable ? (
                <button
                  onClick={startRelatedPractice}
                  className={getPracticeModeTabClass('related')}
                >
                  Practice related
                </button>
              ) : null}
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
        <div className="mb-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            <span>
            Practice {practiceIndex + 1}/{practiceQueue.length}
            {practiceType !== 'all' ? ` · ${getVocabTypeLabel(practiceType)}` : ''}
            {practiceModeKind === 'related'
              ? ' · Related'
              : practiceModeKind === 'due'
                ? ' · Due'
                : ' · All'}
            </span>
            <span className="rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-2 py-0.5 text-[11px] text-[var(--chip-text)]">
              {getVocabTypeLabel(
                normalizeVocabType(currentPractice.wordType, {
                  word: currentPractice.word,
                  definition: currentPractice.translation,
                }) ?? 'other'
              )}
            </span>
          </div>
          <p className="text-[2.2rem] leading-none font-semibold mb-3">{currentPractice.word}</p>
          {revealed ? (
            <>
              <p className="text-xl text-[var(--foreground)]/92 mb-3">{currentPractice.translation}</p>
              {currentPractice.exampleSentence ? (
                <p className="text-sm text-[var(--muted)] mb-3 italic border-l-2 border-[var(--card-border)] pl-3">
                  {currentPractice.exampleSentence}
                </p>
              ) : null}
              {currentPractice.sourcePath ? (
                <a
                  href={currentPractice.sourcePath}
                  className="inline-flex mb-3 text-sm text-[var(--primary)] hover:opacity-85"
                >
                  Open story
                </a>
              ) : null}
              {!favoriteIdentitySet.has(getFavoriteIdentity(currentPractice)) ? (
                <div className="mb-3">
                  <button
                    onClick={() => void saveRelatedFavorite(currentPractice)}
                    className="rounded-lg border border-[#6ea98d] bg-[#4e7f69] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#588b73]"
                  >
                    Save to Favorites
                  </button>
                </div>
              ) : (
                <div className="mb-3">
                  <button
                    onClick={() => void removeRelatedFavorite(currentPractice)}
                    className="rounded-lg border border-[#d28fa0] bg-[#b96e83] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#c3798f]"
                  >
                    Remove from Favorites
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => rateCurrent('again')}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    practiceScore === 'again'
                      ? 'border-[#cf879b] bg-[#b96e83] text-white'
                      : 'border-[#e7c1cb] bg-[#fdeef2] text-[#8a5563] hover:bg-[#fadfe7]'
                  }`}
                >
                  Again
                </button>
                <button
                  onClick={() => rateCurrent('hard')}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    practiceScore === 'hard'
                      ? 'border-[#d8b35f] bg-[#c49b43] text-white'
                      : 'border-[#ead7a0] bg-[#fff6d9] text-[#8a7341] hover:bg-[#fdf0c1]'
                  }`}
                >
                  Tricky
                </button>
                <button
                  onClick={() => rateCurrent('easy')}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    practiceScore === 'easy'
                      ? 'border-[#7bb89b] bg-[#5fa07f] text-white'
                      : 'border-[#b9e0cb] bg-[#ebfaf1] text-[#4f7a62] hover:bg-[#d8f4e4]'
                  }`}
                >
                  Clear
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => {
                if (!currentPracticeKey) return;
                setRevealedPracticeKeys((keys) =>
                  keys.includes(currentPracticeKey) ? keys : [...keys, currentPracticeKey]
                );
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              Reveal answer
            </button>
          )}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={goToPreviousPractice}
              disabled={practiceIndex === 0}
              className="px-3 py-2 rounded-lg border border-[#284565] bg-[#132d4a] text-[#dce7f5] text-sm font-medium transition-colors hover:bg-[#183756] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Previous
            </button>
            <button
              onClick={goToNextPractice}
              className="px-3 py-2 rounded-lg border border-[#315884] bg-[#1b3f67] text-[#edf4ff] text-sm font-medium transition-colors hover:bg-[#224a76]"
            >
              Next
            </button>
          </div>
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
        {!user ? (
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
            <p className="text-lg font-semibold text-[var(--foreground)]">
              Sign in to save words and review them here.
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Your saved vocabulary will appear here once you start reading and adding words to favorites.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/sign-in?redirect_url=%2Ffavorites"
                className="inline-flex rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
              >
                Sign in
              </Link>
              <Link
                href="/explore/stories"
                className="inline-flex rounded-lg border border-[var(--card-border)] bg-[var(--bg-content)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)] transition"
              >
                Explore stories
              </Link>
              <Link
                href="/explore/books"
                className="inline-flex rounded-lg border border-[var(--card-border)] bg-[var(--bg-content)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)] transition"
              >
                Browse books
              </Link>
            </div>
          </div>
        ) : favorites.length === 0 ? (
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
            <p className="text-lg font-semibold text-[var(--foreground)]">
              No favorites saved yet.
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Save words while reading and they will show up here for review.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/explore/stories"
                  className="inline-flex rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                >
                  Explore stories
                </Link>
                <Link
                  href="/explore/books"
                  className="inline-flex rounded-lg border border-[var(--card-border)] bg-[var(--bg-content)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)] transition"
                >
                  Browse books
                </Link>
              </div>
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
