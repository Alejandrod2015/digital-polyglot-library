'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { ChevronDown, Play, Square } from 'lucide-react';
import { getLanguageFlag } from '@/lib/languageFlags';
import { getSpeechSynthesisLang } from '@/lib/practiceExercises';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { books } from '@/data/books';
import { formatLanguageCode } from '@domain/displayFormat';
import {
  sortPracticeItemsByOnboarding,
  type OnboardingGoal,
  type OnboardingPracticePrefs,
} from '@/lib/onboarding';
import {
  VOCAB_TYPE_ORDER,
  VocabTypeKey,
  getVocabTypeLabel,
  normalizeVocabType,
} from '@/lib/vocabTypes';
import { MasteryBadge } from '@/components/MasteryBadge';

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
  const [languageSwitcherOpen, setLanguageSwitcherOpen] = useState(false);
  // Which favorite word is currently being read aloud (so its play button
  // can flip to a "stop" icon). null when nothing is playing.
  const [playingWordKey, setPlayingWordKey] = useState<string | null>(null);

  // Pronounce a favorite via the Web Speech API. Prefer the example
  // sentence if present (gives natural prosody); fall back to the word.
  // Tapping the same word again stops the playback. Tapping a different
  // word cancels the current utterance and starts the new one.
  const playWord = (fav: FavoriteItem) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const key = `${fav.word}-${fav.language ?? ''}`;
    // Toggle off if same word
    if (playingWordKey === key) {
      synth.cancel();
      setPlayingWordKey(null);
      return;
    }
    synth.cancel();
    const text = fav.exampleSentence?.trim() || fav.word;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = getSpeechSynthesisLang(fav.language);
    utt.rate = 0.9;
    utt.onend = () => setPlayingWordKey((cur) => (cur === key ? null : cur));
    utt.onerror = () => setPlayingWordKey((cur) => (cur === key ? null : cur));
    setPlayingWordKey(key);
    synth.speak(utt);
  };
  const onboardingPracticePrefs = useMemo<OnboardingPracticePrefs>(() => {
    const metadata = user?.publicMetadata ?? {};
    const interests = Array.isArray(metadata.interests)
      ? metadata.interests.filter((value): value is string => typeof value === 'string')
      : [];
    return {
      interests,
      learningGoal: typeof metadata.learningGoal === 'string' ? (metadata.learningGoal as OnboardingGoal) : null,
      dailyMinutes: typeof metadata.dailyMinutes === 'number' ? metadata.dailyMinutes : null,
    };
  }, [user]);
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
  const sortedFavorites = useMemo(
    () => sortPracticeItemsByOnboarding(favorites, onboardingPracticePrefs, true),
    [favorites, onboardingPracticePrefs]
  );
  const dueFavorites = useMemo(
    () => sortPracticeItemsByOnboarding(favorites.filter((fav) => isDue(srsMap[normalizeWord(fav.word)], now)), onboardingPracticePrefs, true),
    [favorites, now, onboardingPracticePrefs, srsMap]
  );
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
    const base = sortedFavorites.filter((fav) => {
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
  }, [allCatalogRelatedItems, favoriteIdentitySet, onboardingPracticePrefs, practiceType, sortedFavorites]);
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
    const source = onlyDue ? dueFavorites : sortedFavorites;
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
    const relatedSet = sortPracticeItemsByOnboarding(relatedPracticeCandidates, onboardingPracticePrefs, false);

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

    if (currentPracticeKey) {
      setPracticeScoresByKey((map) => ({ ...map, [currentPracticeKey]: score }));
    }

    if (practiceModeKind === 'related') {
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

  // Active language for the flag pill. Resolution order:
  //   1. user.publicMetadata.targetLanguages[0] (explicit preference)
  //   2. most-common language across the user's actual favorites
  //   3. nothing → we hide the pill instead of showing a "🌐 ??" stub
  const metadataLanguage = (() => {
    const tl = user?.publicMetadata?.targetLanguages;
    if (Array.isArray(tl) && typeof tl[0] === 'string') return tl[0] as string;
    return null;
  })();
  const inferredLanguageFromFavs = useMemo(() => {
    if (favorites.length === 0) return null;
    const counts = new Map<string, number>();
    for (const f of favorites) {
      if (!f.language) continue;
      counts.set(f.language, (counts.get(f.language) ?? 0) + 1);
    }
    let best: { lang: string; n: number } | null = null;
    for (const [lang, n] of counts) {
      if (!best || n > best.n) best = { lang, n };
    }
    return best?.lang ?? null;
  }, [favorites]);
  const activeLanguageName = metadataLanguage ?? inferredLanguageFromFavs;
  const activeVariantKey =
    typeof user?.publicMetadata?.preferredVariant === 'string'
      ? (user.publicMetadata.preferredVariant as string)
      : null;
  const activeFlag = activeLanguageName ? getLanguageFlag(activeLanguageName, activeVariantKey) : null;
  // Convert "Spanish" → "ES", "es" → "ES", "es-mx" → "ES", etc.
  const activeLangShort = activeLanguageName
    ? (() => {
        const map: Record<string, string> = {
          spanish: 'ES', english: 'EN', french: 'FR', german: 'DE',
          italian: 'IT', portuguese: 'PT', japanese: 'JA', korean: 'KO',
          chinese: 'ZH',
        };
        const key = activeLanguageName.toLowerCase();
        return map[key] ?? activeLanguageName.slice(0, 2).toUpperCase();
      })()
    : null;
  // "9 in journey": favorites that came from journey stories. We use the
  // sourcePath as the marker — anything under /journey or with a storySlug
  // counts as journey-sourced. Falls back to total favorites - dueFavorites.
  const journeyFavoritesCount = favorites.filter((f) => Boolean(f.storySlug)).length;
  const readyNowCount = dueFavorites.length;

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto text-[var(--foreground)] pb-24">
      {/* ── iPhone-style hero — visible on every viewport ── */}
      <div className="mb-5">
        <div className="flex items-center gap-4 mb-3">
          {activeFlag && activeLangShort ? (
            <button
              type="button"
              onClick={() => setLanguageSwitcherOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/10 pl-1.5 pr-3 py-1.5 active:bg-white/[0.1] transition-colors"
              aria-label="Switch language"
            >
              <span
                className="rounded-full bg-black/30 grid place-items-center text-lg leading-none"
                style={{ width: 28, height: 28 }}
              >
                {activeFlag}
              </span>
              <span className="text-[13px] font-extrabold text-white">{activeLangShort}</span>
              <ChevronDown size={14} className="text-white/55" />
            </button>
          ) : null}
          <h1 className="text-[28px] font-black tracking-tight text-white leading-none">Favorites</h1>
        </div>
        <p className="text-[13px] font-bold text-white/90">
          {journeyFavoritesCount} in journey
          <span className="text-white/35"> · </span>
          {readyNowCount} ready now
        </p>
      </div>

      {/* ── MOBILE TYPE FILTER (horizontal scroll pills) ── */}
      {favorites.length > 0 ? (
        <div className="-mx-4 px-4 mb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-2 w-max">
            <button
              type="button"
              onClick={() => setPracticeType('all')}
              className={`rounded-full px-4 py-2 text-[13px] font-bold transition-colors shrink-0 ${
                practiceType === 'all'
                  ? 'bg-[var(--color-gold)] text-[#2a1a02]'
                  : 'bg-white/[0.05] border border-white/10 text-white/85'
              }`}
            >
              All types
            </button>
            {availablePracticeTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPracticeType(type)}
                className={`rounded-full px-4 py-2 text-[13px] font-bold transition-colors shrink-0 ${
                  practiceType === type
                    ? 'bg-[var(--color-gold)] text-[#2a1a02]'
                    : 'bg-white/[0.05] border border-white/10 text-white/85'
                }`}
              >
                {getVocabTypeLabel(type)} ({favoriteTypeCounts[type] ?? 0})
              </button>
            ))}
          </div>
        </div>
      ) : null}

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
              {!favoriteIdentitySet.has(getFavoriteIdentity(currentPractice)) ? (
                <div className="mb-3">
                  <button
                    onClick={() => void saveRelatedFavorite(currentPractice)}
                    className="rounded-lg border border-emerald-300 bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 shadow-[0_10px_24px_rgba(16,185,129,0.28)]"
                  >
                    Save to Favorites
                  </button>
                </div>
              ) : (
                <div className="mb-3">
                  <button
                    onClick={() => void removeRelatedFavorite(currentPractice)}
                    className="rounded-lg border border-red-400 bg-red-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-400 shadow-[0_10px_24px_rgba(239,68,68,0.28)]"
                  >
                    Remove from Favorites
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => rateCurrent('again')}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    practiceScore === 'again'
                      ? 'border-red-400 bg-red-500 text-white shadow-[0_10px_24px_rgba(239,68,68,0.34)]'
                      : 'border-white/12 bg-white/5 text-white/78 hover:border-red-300/35 hover:bg-red-400/10 hover:text-red-100'
                  }`}
                >
                  Again
                </button>
                <button
                  onClick={() => rateCurrent('hard')}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    practiceScore === 'hard'
                      ? 'border-yellow-300 bg-yellow-400 text-slate-950 shadow-[0_10px_24px_rgba(250,204,21,0.3)]'
                      : 'border-white/12 bg-white/5 text-white/78 hover:border-yellow-200/35 hover:bg-yellow-300/10 hover:text-yellow-100'
                  }`}
                >
                  Tricky
                </button>
                <button
                  onClick={() => rateCurrent('easy')}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    practiceScore === 'easy'
                      ? 'border-emerald-300 bg-emerald-500 text-white shadow-[0_10px_24px_rgba(16,185,129,0.3)]'
                      : 'border-white/12 bg-white/5 text-white/78 hover:border-emerald-200/35 hover:bg-emerald-300/10 hover:text-emerald-100'
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
            /* iPhone-style cards: word + type, segmented progress,
               story context italic, definition, play button.
               Las pills de tipo (líneas ~780) mutan `practiceType`,
               pero antes solo filtraban Practice / Related — la lista
               visible se mostraba completa. Ahora también filtramos
               aquí para que las pills sí filtren lo que el user ve. */
            <ul className="space-y-3">
              {sortedFavorites
                .filter((fav) =>
                  practiceType === 'all'
                    ? true
                    : (normalizeVocabType(fav.wordType, {
                        word: fav.word,
                        definition: fav.translation,
                      }) ?? 'other') === practiceType
                )
                .map((fav) => {
                const meta = srsMap[normalizeWord(fav.word)];
                const streak = meta?.streak ?? fav.streak ?? 0;
                // 5-segment progress bar. Each segment lights up per
                // streak step (capped at 5). Empty segments are dimmed.
                const segments = Array.from({ length: 5 }, (_, i) => i < Math.min(streak, 5));
                const type = normalizeVocabType(fav.wordType, {
                  word: fav.word,
                  definition: fav.translation,
                }) ?? 'other';
                return (
                  <li
                    key={`m-${fav.word}`}
                    className="relative rounded-2xl border border-white/8 bg-[#0c2342] pl-3 pr-3 py-3"
                  >
                    {/* gold left accent bar */}
                    <span
                      aria-hidden
                      className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-[var(--color-gold)]"
                    />
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1 pl-1">
                        <div className="flex items-baseline gap-2">
                          <p className="text-[22px] font-black leading-none text-white truncate">
                            {fav.word}
                          </p>
                          <span className="text-[11px] font-bold text-white/45">
                            {getVocabTypeLabel(type).toLowerCase()}
                          </span>
                        </div>
                        <div className="mt-2 flex gap-1">
                          {segments.map((on, i) => (
                            <span
                              key={i}
                              className={`h-1 w-7 rounded-full ${on ? 'bg-[var(--color-gold)]' : 'bg-white/12'}`}
                            />
                          ))}
                        </div>
                        {fav.storyTitle ? (
                          <p className="mt-2 text-[12px] italic text-white/55 truncate">
                            {fav.storyTitle}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[14px] font-bold text-white leading-snug line-clamp-2">
                          {fav.translation}
                        </p>
                      </div>
                      {(() => {
                        const key = `${fav.word}-${fav.language ?? ''}`;
                        const playing = playingWordKey === key;
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playWord(fav);
                            }}
                            aria-label={playing ? `Stop ${fav.word}` : `Pronounce ${fav.word}`}
                            className="shrink-0 w-11 h-11 rounded-full bg-transparent border-2 border-[var(--color-gold)] grid place-items-center text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 transition-colors"
                          >
                            {playing ? (
                              <Square size={14} fill="currentColor" />
                            ) : (
                              <Play size={16} fill="currentColor" />
                            )}
                          </button>
                        );
                      })()}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <LanguageSwitcher
        open={languageSwitcherOpen}
        onClose={() => setLanguageSwitcherOpen(false)}
      />
    </div>
  );
}
