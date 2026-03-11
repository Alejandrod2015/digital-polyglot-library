'use client';

import { useUser } from '@clerk/nextjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Loader2, Music, CheckCircle, X } from 'lucide-react';
import StoryContent from '@/components/StoryContent';
import VocabPanel from '@/components/VocabPanel';
import { broadLevelFromCefr } from '@/lib/cefr';
import { formatCefrLevel, formatLanguage, formatLevel, toTitleCase } from '@/lib/displayFormat';

type Plan = 'free' | 'basic' | 'premium' | 'polyglot';
type CreateStatus = 'idle' | 'generating_text' | 'generating_audio' | 'done' | 'audio_failed';
type AudioStatus = 'pending' | 'generating' | 'ready' | 'failed';

type VocabItem = { word: string; definition: string; type?: string };

type GeneratedStory = {
  id: string;
  slug: string;
  title: string;
  text: string;
  vocab?: VocabItem[];
  language?: string;
  region?: string | null;
  level?: string;
  cefrLevel?: string;
  audioUrl?: string | null;
  audioStatus?: AudioStatus | null;
  audioSegments?: unknown;
};

type CreateApiResponse = {
  story?: GeneratedStory;
  error?: string;
  details?: string;
};

type CreateRequestPayload = {
  language: string;
  region: string;
  cefrLevel: string;
  level: string;
  focus: string;
  topic: string;
  customTopic?: string;
};

type PendingCreate = {
  payload: CreateRequestPayload;
  startedAt: number;
  storyId?: string;
  lastKnownStory?: GeneratedStory;
};

type FavoriteItem = {
  word: string;
  translation: string;
  wordType?: string | null;
  exampleSentence?: string | null;
  nextReviewAt?: string | null;
  lastReviewedAt?: string | null;
  streak?: number | null;
};

type ReviewScore = 'again' | 'hard' | 'easy';

const regionsByLanguage: Record<string, string[]> = {
  Spanish: ['Colombia', 'Mexico', 'Argentina', 'Peru', 'Spain', 'Chile', 'Other'],
  English: ['US', 'UK', 'Australia', 'Canada', 'Other'],
  German: ['Germany', 'Austria', 'Switzerland', 'Other'],
  French: ['France', 'Canada', 'Belgium', 'Other'],
  Italian: ['Italy', 'Switzerland', 'Other'],
  Portuguese: ['Portugal', 'Brazil', 'Other'],
};

const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const focusOptions = [
  'Everyday conversation',
  'Useful phrases',
  'Verbs in context',
  'Idioms & expressions',
  'Colloquial speech',
  'Storytelling in the past',
  'Future plans & intentions',
  'Formal situations',
];
const topicOptions = [
  'Daily life',
  'Travel & transport',
  'Food & restaurants',
  'Work & study',
  'Family & relationships',
  'Culture & traditions',
  'Friendship & conflict',
  'Housing & neighbors',
  'Health & wellbeing',
  'Money & shopping',
  'City life',
  'Nature & places',
];
const CUSTOM_TOPIC_MAX = 120;
const CREATE_PENDING_TTL_MS = 1000 * 60 * 30;
const RECOVERY_LOOKUP_WINDOW_MS = 1000 * 45;
const RECOVERY_LOOKUP_INTERVAL_MS = 2500;
const AUDIO_DELAY_NOTICE_MS = 20_000;

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

function removeKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

function isFresh(timestamp: number, ttlMs: number): boolean {
  return Date.now() - timestamp <= ttlMs;
}

function isStory(value: unknown): value is GeneratedStory {
  if (!value || typeof value !== 'object') return false;
  const story = value as Partial<GeneratedStory>;
  return typeof story.id === 'string' && typeof story.slug === 'string' && typeof story.title === 'string';
}

function isAudioReady(story: GeneratedStory | null | undefined): boolean {
  if (!story) return false;
  return !!story.audioUrl || story.audioStatus === 'ready';
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
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

export default function CreatePage() {
  const { user, isLoaded } = useUser();

  const [language, setLanguage] = useState('');
  const [region, setRegion] = useState('');
  const [cefrLevel, setCefrLevel] = useState('');
  const [focus, setFocus] = useState('');
  const [topic, setTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [response, setResponse] = useState<CreateApiResponse | null>(null);
  const [status, setStatus] = useState<CreateStatus>('idle');
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [practiceQueue, setPracticeQueue] = useState<FavoriteItem[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [practiceVisible, setPracticeVisible] = useState(false);
  const [practiceCompleted, setPracticeCompleted] = useState(false);
  const [practiceModalMounted, setPracticeModalMounted] = useState(false);
  const [practiceModalOpen, setPracticeModalOpen] = useState(false);
  const [showComeBackLater, setShowComeBackLater] = useState(false);

  const didTryResumeRef = useRef(false);
  const didInitPracticeRef = useRef(false);

  const userStorageScope = user?.id ?? 'guest';
  const pendingKey = useMemo(() => `dp_create_pending_v2_${userStorageScope}`, [userStorageScope]);

  const plan = (user?.publicMetadata?.plan as Plan | undefined) ?? 'free';

  const availableRegions = regionsByLanguage[language as keyof typeof regionsByLanguage] || [];

  const buildPayload = useCallback((): CreateRequestPayload => {
    const resolvedFocus = focus.trim();
    const resolvedTopic = (customTopic.trim() || topic).trim();
    const broadLevel = broadLevelFromCefr(cefrLevel) ?? 'beginner';
    return {
      language,
      region,
      cefrLevel,
      level: broadLevel,
      focus: resolvedFocus,
      topic: resolvedTopic,
      customTopic: customTopic.trim() || undefined,
    };
  }, [cefrLevel, customTopic, focus, language, region, topic]);

  const pollAudioUntilReady = useCallback(async (story: GeneratedStory): Promise<GeneratedStory> => {
    const maxWaitMs = 1000 * 60 * 3;
    const intervalMs = 3000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < maxWaitMs) {
      const check = await fetch(`/api/user-stories?id=${story.id}`, { cache: 'no-store' });
      const json = (await check.json()) as { story?: GeneratedStory };
      if (json.story && isStory(json.story)) {
        setResponse({ story: json.story });
      }
      if (json.story?.audioStatus === 'failed') return json.story;
      if (json.story && isAudioReady(json.story)) return json.story;
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    return story;
  }, []);

  const findRecoveredStory = useCallback(async (pending: PendingCreate): Promise<GeneratedStory | null> => {
      const params = new URLSearchParams({
        mine: '1',
        latestForCreate: '1',
        language: pending.payload.language,
        cefrLevel: pending.payload.cefrLevel,
        level: pending.payload.level,
        focus: pending.payload.focus,
      topic: pending.payload.topic,
      since: String(pending.startedAt),
    });

    if (pending.payload.region) params.set('region', pending.payload.region);

    const res = await fetch(`/api/user-stories?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { story?: unknown | null };
    if (!isStory(json.story)) return null;
    return json.story;
  }, []);

  const finishAsDone = useCallback((story: GeneratedStory) => {
    setResponse({ story });
    setStatus('done');
    setResumeNotice(null);
    setShowComeBackLater(false);
    removeKey(pendingKey);
  }, [pendingKey]);

  const handleComeBackLater = useCallback(() => {
    setStatus('idle');
    setShowComeBackLater(false);
    setResumeNotice('Audio is still being prepared. You can come back later and we will resume automatically.');
    setResponse(null);
  }, []);

  const runGeneration = useCallback(
    async (payload: CreateRequestPayload) => {
      if (status === 'generating_text' || status === 'generating_audio') return;
      setStatus('generating_text');
      setResponse(null);
      setResumeNotice(null);

      const pending: PendingCreate = {
        payload,
        startedAt: Date.now(),
      };
      writeJson(pendingKey, pending);

      try {
        const res = await fetch('/api/user/generate-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = (await res.json()) as CreateApiResponse;
        if (!res.ok || !data.story) {
          const rawMessage = `${data.error ?? ""} ${data.details ?? ""}`.toLowerCase();
          const isProviderOrQuotaError =
            rawMessage.includes("insufficient_quota") ||
            rawMessage.includes("rate limit") ||
            rawMessage.includes("openai") ||
            rawMessage.includes("temporarily unavailable");
          const safeMessage = isProviderOrQuotaError
            ? "Story generation is temporarily unavailable. Please try again shortly."
            : (data.error || "Story generation failed");
          throw new Error(safeMessage);
        }

        setStatus('generating_audio');
        setResponse({ story: data.story });

        writeJson(pendingKey, {
          ...pending,
          storyId: data.story.id,
          lastKnownStory: data.story,
        } satisfies PendingCreate);

        const storyWithAudio = await pollAudioUntilReady(data.story);
        if (storyWithAudio.audioStatus === 'failed') {
          setResponse({ story: storyWithAudio });
          setStatus('audio_failed');
          removeKey(pendingKey);
          return;
        }

        if (isAudioReady(storyWithAudio)) {
          finishAsDone(storyWithAudio);
          return;
        }

        setResponse({ story: storyWithAudio });
        setStatus('generating_audio');
      } catch (error) {
        console.error('Error:', error);
        setResponse({ error: (error as Error).message });
        setStatus('idle');
        removeKey(pendingKey);
      }
    },
    [finishAsDone, pendingKey, pollAudioUntilReady, status]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await runGeneration(buildPayload());
    },
    [buildPayload, runGeneration]
  );

  useEffect(() => {
    if (!isLoaded || !user) return;
    let cancelled = false;
    const loadFavorites = async () => {
      try {
        const res = await fetch('/api/favorites', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as FavoriteItem[];
        if (!cancelled && Array.isArray(data)) setFavorites(data);
      } catch {
        // ignore favorites loading errors
      }
    };
    void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, user]);

  useEffect(() => {
    if (!isLoaded || !user || didTryResumeRef.current) return;
    didTryResumeRef.current = true;

    const restore = async () => {
      const pending = readJson<PendingCreate>(pendingKey);
      if (!pending) {
        setResumeChecked(true);
        return;
      }

      if (!isFresh(pending.startedAt, CREATE_PENDING_TTL_MS)) {
        removeKey(pendingKey);
        setResumeChecked(true);
        return;
      }

      setStatus('generating_text');
      setResumeNotice('Resuming your previous story generation...');

      try {
        if (pending.storyId) {
          const check = await fetch(`/api/user-stories?id=${pending.storyId}`, { cache: 'no-store' });
          const json = (await check.json()) as { story?: GeneratedStory };
          if (json.story && isStory(json.story)) {
            setStatus('generating_audio');
            setResponse({ story: json.story });
            const ready = await pollAudioUntilReady(json.story);
            if (ready.audioStatus === 'failed') {
              setResponse({ story: ready });
              setStatus('audio_failed');
              removeKey(pendingKey);
            } else if (isAudioReady(ready)) {
              finishAsDone(ready);
            } else {
              setResponse({ story: ready });
              setStatus('generating_audio');
            }
            setResumeChecked(true);
            return;
          }
        }

        const startedLookupAt = Date.now();
        let recovered = await findRecoveredStory(pending);
        while (!recovered && Date.now() - startedLookupAt < RECOVERY_LOOKUP_WINDOW_MS) {
          await new Promise((r) => setTimeout(r, RECOVERY_LOOKUP_INTERVAL_MS));
          recovered = await findRecoveredStory(pending);
        }

        if (recovered) {
          setStatus('generating_audio');
          setResponse({ story: recovered });
          const ready = await pollAudioUntilReady(recovered);
          if (ready.audioStatus === 'failed') {
            setResponse({ story: ready });
            setStatus('audio_failed');
            removeKey(pendingKey);
          } else if (isAudioReady(ready)) {
            finishAsDone(ready);
          } else {
            setResponse({ story: ready });
            setStatus('generating_audio');
          }
          setResumeChecked(true);
          return;
        }

        removeKey(pendingKey);
        setStatus('idle');
        setResumeNotice('Previous generation could not be resumed. You can generate again.');
        setResumeChecked(true);
      } catch {
        setStatus('idle');
        setResumeNotice('Could not resume automatically.');
        setResumeChecked(true);
      }
    };

    void restore();
  }, [findRecoveredStory, finishAsDone, isLoaded, pendingKey, pollAudioUntilReady, user]);

  useEffect(() => {
    if (status !== 'generating_audio') {
      setShowComeBackLater(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowComeBackLater(true);
    }, AUDIO_DELAY_NOTICE_MS);

    return () => window.clearTimeout(timer);
  }, [status]);

  const shuffleWords = useCallback((items: FavoriteItem[]) => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);

  const restartPractice = useCallback(() => {
    if (practiceQueue.length === 0) return;
    setPracticeQueue((prev) => shuffleWords(prev));
    setPracticeIndex(0);
    setRevealed(false);
    setPracticeCompleted(false);
  }, [practiceQueue.length, shuffleWords]);

  useEffect(() => {
    const generating = status === 'generating_text' || status === 'generating_audio';
    if (!generating) {
      didInitPracticeRef.current = false;
      setPracticeVisible(false);
      setPracticeCompleted(false);
      return;
    }
    if (didInitPracticeRef.current) return;
    didInitPracticeRef.current = true;
    if (favorites.length === 0) return;

    const unique = Array.from(
      new Map(
        favorites.map((fav) => [normalizeWord(fav.word), fav] as const)
      ).values()
    );
    setPracticeQueue(shuffleWords(unique));
    setPracticeIndex(0);
    setRevealed(false);
    setPracticeCompleted(false);
    setPracticeVisible(true);
  }, [favorites, shuffleWords, status]);

  const currentPractice = practiceQueue[practiceIndex] ?? null;
  const isGenerating = status === 'generating_text' || status === 'generating_audio';
  const shouldShowPracticeModal = isGenerating && practiceVisible && practiceQueue.length > 0;

  useEffect(() => {
    if (shouldShowPracticeModal) {
      setPracticeModalMounted(true);
      const openTimer = window.setTimeout(() => setPracticeModalOpen(true), 10);
      return () => window.clearTimeout(openTimer);
    }

    setPracticeModalOpen(false);
    if (!practiceModalMounted) return;
    const closeTimer = window.setTimeout(() => setPracticeModalMounted(false), 220);
    return () => window.clearTimeout(closeTimer);
  }, [practiceModalMounted, shouldShowPracticeModal]);

  const handlePracticeScore = useCallback(
    async (score: ReviewScore) => {
      const current = currentPractice;
      if (!current || !user) return;
      const streak = typeof current.streak === 'number' ? current.streak : 0;
      const next = computeNextReview(score, streak);
      const lastReviewedAt = Date.now();

      try {
        await fetch('/api/favorites', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: current.word,
            nextReviewAt: new Date(next.nextReviewAt).toISOString(),
            lastReviewedAt: new Date(lastReviewedAt).toISOString(),
            streak: next.streak,
          }),
        });
      } catch {
        // ignore update failures during generation
      }

      setFavorites((prev) =>
        prev.map((fav) =>
          normalizeWord(fav.word) === normalizeWord(current.word)
            ? {
                ...fav,
                nextReviewAt: new Date(next.nextReviewAt).toISOString(),
                lastReviewedAt: new Date(lastReviewedAt).toISOString(),
                streak: next.streak,
              }
            : fav
        )
      );

      setRevealed(false);
      setPracticeIndex((idx) => {
        if (idx + 1 < practiceQueue.length) return idx + 1;
        setPracticeCompleted(true);
        return idx;
      });
    },
    [currentPractice, practiceQueue.length, user]
  );

  if (!isLoaded) return null;

  if (plan !== 'polyglot') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center text-[var(--muted)]">
        <h2 className="text-2xl font-semibold mb-4">Restricted Access</h2>
        <p className="max-w-md mb-4">
          This section is only available to users with a Polyglot plan.
        </p>
        <Link
          href="/plans"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition"
        >
          View Plans
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 text-[var(--foreground)]">
      <div className="flex items-center gap-3 mb-8">
        <Sparkles className="h-7 w-7 text-[var(--foreground)]" />
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Create a Story</h1>
      </div>

      {resumeNotice ? (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-100">
          {resumeNotice}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-[var(--surface)] p-6 rounded-xl border border-[var(--card-border)]"
      >
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Language</label>
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              setRegion('');
            }}
            required
            className="w-full rounded-md bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--card-border)] p-2 focus:outline-none"
          >
            <option value="">Select language</option>
            {Object.keys(regionsByLanguage).map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        {availableRegions.length > 0 && (
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Region (optional)</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-md bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--card-border)] p-2 focus:outline-none"
            >
              <option value="">No region</option>
              {availableRegions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">CEFR level</label>
          <select
            value={cefrLevel}
            onChange={(e) => setCefrLevel(e.target.value)}
            required
            className="w-full rounded-md bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--card-border)] p-2 focus:outline-none"
          >
            <option value="">Select CEFR level</option>
            {cefrLevels.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Focus</label>
          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            required
            className="w-full rounded-md bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--card-border)] p-2 focus:outline-none"
          >
            <option value="">Select focus</option>
            {focusOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">Topic</label>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
            className="w-full rounded-md bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--card-border)] p-2 focus:outline-none"
          >
            <option value="">Select topic</option>
            {topicOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">
            Custom topic (optional, max {CUSTOM_TOPIC_MAX} chars)
          </label>
          <input
            type="text"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value.slice(0, CUSTOM_TOPIC_MAX))}
            maxLength={CUSTOM_TOPIC_MAX}
            placeholder="e.g. Two coworkers negotiating deadlines in Berlin"
            className="w-full rounded-md bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--card-border)] p-2 focus:outline-none"
          />
          <p className="mt-1 text-xs text-[var(--muted)] text-right">
            {customTopic.length}/{CUSTOM_TOPIC_MAX}
          </p>
        </div>

        <button
          type="submit"
          disabled={!resumeChecked || status === 'generating_text' || status === 'generating_audio'}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md transition disabled:opacity-70"
        >
          {!resumeChecked && (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Checking previous generation...
            </>
          )}
          {resumeChecked && status === 'idle' && 'Generate Story'}
          {status === 'generating_text' && (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Generating story...
            </>
          )}
          {status === 'generating_audio' && (
            <>
              <Music className="w-5 h-5 animate-pulse" /> Generating audio...
            </>
          )}
          {status === 'done' && (
            <>
              <CheckCircle className="w-5 h-5 text-white" /> Story ready!
            </>
          )}
          {status === 'audio_failed' && (
            <>
              <CheckCircle className="w-5 h-5 text-white" /> Story ready · audio unavailable
            </>
          )}
        </button>

        {status === 'generating_audio' && showComeBackLater ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-[var(--foreground)]">
            <p className="font-medium">Audio is taking longer than usual.</p>
            <p className="mt-1 text-[var(--muted)]">
              We are still preparing your narration. You can keep this tab open or come back later.
            </p>
            <button
              type="button"
              onClick={handleComeBackLater}
              className="mt-3 inline-flex rounded-lg border border-[var(--card-border)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
            >
              I&apos;ll come back later
            </button>
          </div>
        ) : null}
      </form>

      {isGenerating && !practiceVisible && practiceQueue.length > 0 ? (
        <button
          type="button"
          onClick={() => setPracticeVisible(true)}
          className="fixed bottom-24 right-4 z-40 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-blue-700"
        >
          Show practice
        </button>
      ) : null}

      {practiceModalMounted ? (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-200 ease-out ${
            practiceModalOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <div
            className={`w-full max-w-md rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5 shadow-2xl transition-all duration-200 ease-out ${
              practiceModalOpen ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.98] opacity-0'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Practice while we generate your story
              </p>
              <button
                type="button"
                onClick={() => setPracticeVisible(false)}
                className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--foreground)]"
                aria-label="Close practice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {practiceCompleted || !currentPractice ? (
              <div className="space-y-4">
                <p className="text-lg font-semibold text-[var(--foreground)]">
                  Great job. No more words in this session.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={restartPractice}
                    className="rounded-lg bg-[var(--card-bg)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
                  >
                    Review again
                  </button>
                  <button
                    type="button"
                    onClick={() => setPracticeVisible(false)}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="mb-2 text-xs text-[var(--muted)]">
                  {practiceIndex + 1}/{practiceQueue.length}
                </p>
                <p className="mb-4 text-3xl font-semibold">{currentPractice.word}</p>
                {revealed ? (
                  <>
                    <p className="mb-4 text-lg text-[var(--foreground)]/92">{currentPractice.translation}</p>
                    {currentPractice.exampleSentence ? (
                      <p className="mb-4 border-l-2 border-[var(--card-border)] pl-3 text-sm italic text-[var(--muted)]">
                        {currentPractice.exampleSentence}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handlePracticeScore('again')}
                        className="rounded-lg bg-red-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
                      >
                        Again
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePracticeScore('hard')}
                        className="rounded-lg bg-amber-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600"
                      >
                        Hard
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePracticeScore('easy')}
                        className="rounded-lg bg-emerald-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                      >
                        Easy
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Reveal answer
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}

      {response?.story && (status === 'done' || status === 'audio_failed') && (
        <StoryPreview story={response.story} />
      )}

      {response?.error && (
        <div className="mt-8 border border-red-700 rounded-xl p-6 bg-red-900/40">
          <h2 className="text-lg font-semibold mb-2 text-red-400">Error</h2>
          <pre className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{response.error}</pre>
        </div>
      )}
    </div>
  );
}

function StoryPreview({ story }: { story: GeneratedStory }) {
  const previewText = story.text;

  return (
    <div className="mt-10 bg-[var(--surface)] border border-[var(--card-border)] rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-2 text-[var(--foreground)]">{story.title}</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        {formatLanguage(story.language || '')} • {story.cefrLevel ? formatCefrLevel(story.cefrLevel) : formatLevel(story.level || '')} •{' '}
        {toTitleCase(story.region || 'General')}
      </p>

      {!isAudioReady(story) ? (
        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--muted)]">
          Audio is still being prepared. You can start reading now and come back in a moment for narration.
        </div>
      ) : null}

      {story.audioStatus === 'failed' ? (
        <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          The story is ready, but audio could not be generated this time.
        </div>
      ) : null}

      <div className="relative">
        <StoryContent
          text={previewText}
          sentencesPerParagraph={3}
          vocab={story.vocab ?? []}
        />
        <VocabPanel story={{ ...story, source: 'polyglot' }} />
      </div>

      <div className="flex justify-end mt-6">
        <Link
          href={`/stories/${story.slug}`}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition font-medium"
        >
          Read full story →
        </Link>
      </div>
    </div>
  );
}
