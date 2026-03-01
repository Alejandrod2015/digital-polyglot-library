'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';

type FavoriteItem = {
  word: string;
  translation: string;
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
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [srsMap, setSrsMap] = useState<SrsMap>({});
  const [isReady, setIsReady] = useState(false); // controla visibilidad final
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceOnlyDue, setPracticeOnlyDue] = useState(true);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const load = async () => {
      // 1️⃣ Cargar de localStorage inmediatamente
      const localFavs = loadFavoritesCache(user?.id);
      setFavorites(localFavs);

      // 2️⃣ Sincronizar backend (en segundo plano)
      if (isLoaded && user) {
        try {
          const res = await fetch('/api/favorites', { cache: 'no-store' });
          const remoteFavs = res.ok ? ((await res.json()) as FavoriteItem[]) : [];
          const merged = [
            ...remoteFavs,
            ...localFavs.filter((f) => !remoteFavs.some((r) => r.word === f.word)),
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
          saveFavoritesCache(user?.id, merged);

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
        const map = loadSrsMap(user?.id);
        setSrsMap(map);
      }

      // 3️⃣ Mostrar el contenido tras pequeño delay para evitar flicker
      setTimeout(() => setIsReady(true), 250);
    };

    void load();
  }, [user, isLoaded]);

  useEffect(() => {
    const refreshFromCache = () => {
      const cached = loadFavoritesCache(user?.id);
      setFavorites(cached);
    };
    window.addEventListener('favorites-updated', refreshFromCache);
    window.addEventListener('storage', refreshFromCache);
    return () => {
      window.removeEventListener('favorites-updated', refreshFromCache);
      window.removeEventListener('storage', refreshFromCache);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!isLoaded) return;
    saveSrsMap(user?.id, srsMap);
  }, [srsMap, user, isLoaded]);

  const now = Date.now();
  const dueFavorites = favorites.filter((fav) => isDue(srsMap[normalizeWord(fav.word)], now));
  const practiceQueue = (practiceOnlyDue ? dueFavorites : favorites).slice();
  const currentPractice = practiceQueue[practiceIndex] ?? null;

  const removeFavorite = async (word: string) => {
    const updated = favorites.filter((f) => f.word !== word);
    setFavorites(updated);
    saveFavoritesCache(user?.id, updated);
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
    setPracticeOnlyDue(onlyDue);
    setPracticeMode(true);
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
    setPracticeIndex(0);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto text-white">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Favorites</h1>
          <p className="text-sm text-gray-400 mt-1">
            {dueFavorites.length} due today · {favorites.length} total
          </p>
        </div>
        {favorites.length > 0 ? (
          <div className="flex gap-2">
            <button
              onClick={() => startPractice(true)}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
            >
              Practice due
            </button>
            <button
              onClick={() => startPractice(false)}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
            >
              Practice all
            </button>
          </div>
        ) : null}
      </div>

      {practiceMode && currentPractice ? (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
            Practice {practiceIndex + 1}/{practiceQueue.length}
          </p>
          <p className="text-3xl font-semibold mb-4">{currentPractice.word}</p>
          {revealed ? (
            <>
              <p className="text-lg text-gray-200 mb-4">{currentPractice.translation}</p>
              {currentPractice.exampleSentence ? (
                <p className="text-sm text-gray-300 mb-4 italic border-l-2 border-white/20 pl-3">
                  {currentPractice.exampleSentence}
                </p>
              ) : null}
              {currentPractice.sourcePath ? (
                <a
                  href={currentPractice.sourcePath}
                  className="inline-flex mb-4 text-sm text-blue-300 hover:text-blue-200"
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
            <div className="h-16 bg-gray-800 rounded animate-pulse" />
            <div className="h-16 bg-gray-800 rounded animate-pulse" />
            <div className="h-16 bg-gray-800 rounded animate-pulse" />
            <div className="h-16 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>

        {/* Contenido real debajo */}
        <div
          className={`transition-opacity duration-700 ${
            isReady ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {favorites.length === 0 ? (
            <p className="text-gray-400">
              {user ? 'No favorites saved yet.' : 'No favorites saved yet.'}
            </p>
          ) : (
            <ul className="space-y-4">
              {favorites.map((fav) => {
                const meta = srsMap[normalizeWord(fav.word)];
                const due = isDue(meta, now);
                return (
                <li
                  key={fav.word}
                  className="bg-gray-800 p-4 rounded-lg shadow flex justify-between items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{fav.word}</p>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${
                          due ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-gray-300'
                        }`}
                      >
                        {due ? 'Due today' : formatNextReview(meta)}
                      </span>
                    </div>
                    <p className="text-white">{fav.translation}</p>
                    {fav.exampleSentence ? (
                      <p className="text-sm text-gray-300 mt-1 line-clamp-2 italic">
                        {fav.exampleSentence}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2">
                      {fav.language ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                          {fav.language}
                        </span>
                      ) : null}
                      {fav.sourcePath ? (
                        <a
                          href={fav.sourcePath}
                          className="text-xs text-blue-300 hover:text-blue-200"
                        >
                          Open story
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFavorite(fav.word)}
                    className="flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors text-sm font-medium"
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
                    Remove
                  </button>
                </li>
              )})}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
