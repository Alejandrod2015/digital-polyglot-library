'use client';

import { useUser } from '@clerk/nextjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Loader2, Music, CheckCircle } from 'lucide-react';
import StoryContent from '@/components/StoryContent';
import VocabPanel from '@/components/VocabPanel';
import { formatLanguage, formatLevel, toTitleCase } from '@/lib/displayFormat';

type Plan = 'free' | 'basic' | 'premium' | 'polyglot';
type CreateStatus = 'idle' | 'generating_text' | 'generating_audio' | 'done';

type VocabItem = { word: string; definition: string };

type GeneratedStory = {
  id: string;
  slug: string;
  title: string;
  text: string;
  vocab?: VocabItem[];
  language?: string;
  region?: string | null;
  level?: string;
  audioUrl?: string | null;
};

type CreateApiResponse = {
  story?: GeneratedStory;
  error?: string;
};

type CreateRequestPayload = {
  language: string;
  region: string;
  level: string;
  focus: string;
  topic: string;
  customTopic?: string;
};

type CreateDraft = {
  language: string;
  region: string;
  level: string;
  focus: string;
  focusMore: string;
  topic: string;
  topicMore: string;
  customTopic: string;
  showMoreFocus: boolean;
  showMoreTopics: boolean;
  updatedAt: number;
};

type PendingCreate = {
  payload: CreateRequestPayload;
  startedAt: number;
  storyId?: string;
  lastKnownStory?: GeneratedStory;
};

const regionsByLanguage: Record<string, string[]> = {
  Spanish: ['Colombia', 'Mexico', 'Argentina', 'Peru', 'Spain', 'Chile', 'Other'],
  English: ['US', 'UK', 'Australia', 'Canada', 'Other'],
  German: ['Germany', 'Austria', 'Switzerland', 'Other'],
  French: ['France', 'Canada', 'Belgium', 'Other'],
  Italian: ['Italy', 'Switzerland', 'Other'],
  Portuguese: ['Portugal', 'Brazil', 'Other'],
};

const levels = ['Beginner', 'Intermediate', 'Advanced'];
const focusCore = ['Verbs', 'Phrases', 'Conversation', 'Grammar', 'Vocabulary', 'Listening'];
const focusExtended = [
  'Connectors',
  'Prepositions',
  'Past tense',
  'Future plans',
  'Formal vs informal',
  'Idioms',
  'Phrasal verbs',
  'Workplace language',
  'Negotiation language',
  'Everyday slang',
];
const topicCore = [
  'Daily life',
  'Work',
  'Travel',
  'Relationships',
  'Money',
  'Health',
  'Culture',
  'Technology',
];
const topicExtended = [
  'Dating',
  'Bureaucracy',
  'Housing',
  'Job interviews',
  'Office politics',
  'Health system',
  'Money stress',
  'Small business',
  'Digital life',
  'Social media',
  'Legal paperwork',
  'Immigration',
  'Neighbors',
  'Conflict resolution',
];
const CUSTOM_TOPIC_MAX = 120;
const CREATE_DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 3;
const CREATE_PENDING_TTL_MS = 1000 * 60 * 30;

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

export default function CreatePage() {
  const { user, isLoaded } = useUser();

  const [language, setLanguage] = useState('');
  const [region, setRegion] = useState('');
  const [level, setLevel] = useState('');
  const [focus, setFocus] = useState('');
  const [focusMore, setFocusMore] = useState('');
  const [topic, setTopic] = useState('');
  const [topicMore, setTopicMore] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [showMoreFocus, setShowMoreFocus] = useState(false);
  const [showMoreTopics, setShowMoreTopics] = useState(false);
  const [response, setResponse] = useState<CreateApiResponse | null>(null);
  const [status, setStatus] = useState<CreateStatus>('idle');
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);

  const didHydrateDraftRef = useRef(false);
  const didTryResumeRef = useRef(false);

  const userStorageScope = user?.id ?? 'guest';
  const draftKey = useMemo(() => `dp_create_draft_v2_${userStorageScope}`, [userStorageScope]);
  const pendingKey = useMemo(() => `dp_create_pending_v2_${userStorageScope}`, [userStorageScope]);

  const plan = (user?.publicMetadata?.plan as Plan | undefined) ?? 'free';

  const availableRegions = regionsByLanguage[language as keyof typeof regionsByLanguage] || [];

  const buildPayload = useCallback((): CreateRequestPayload => {
    const resolvedFocus = (focusMore || focus).trim();
    const resolvedTopic = (customTopic.trim() || topicMore || topic).trim();
    return {
      language,
      region,
      level,
      focus: resolvedFocus,
      topic: resolvedTopic,
      customTopic: customTopic.trim() || undefined,
    };
  }, [customTopic, focus, focusMore, language, level, region, topic, topicMore]);

  const pollAudioUntilReady = useCallback(async (story: GeneratedStory): Promise<GeneratedStory> => {
    const maxWaitMs = 90_000;
    const intervalMs = 3000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < maxWaitMs) {
      const check = await fetch(`/api/user-stories?id=${story.id}`, { cache: 'no-store' });
      const json = (await check.json()) as { story?: GeneratedStory };
      if (json.story?.audioUrl) return json.story;
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    return story;
  }, []);

  const findRecoveredStory = useCallback(async (pending: PendingCreate): Promise<GeneratedStory | null> => {
    const params = new URLSearchParams({
      mine: '1',
      latestForCreate: '1',
      language: pending.payload.language,
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
    removeKey(pendingKey);
  }, [pendingKey]);

  const runGeneration = useCallback(
    async (payload: CreateRequestPayload) => {
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
        if (!res.ok || !data.story) throw new Error(data.error || 'Story generation failed');

        setStatus('generating_audio');
        setResponse({ story: data.story });

        writeJson(pendingKey, {
          ...pending,
          storyId: data.story.id,
          lastKnownStory: data.story,
        } satisfies PendingCreate);

        const storyWithAudio = await pollAudioUntilReady(data.story);
        finishAsDone(storyWithAudio);
      } catch (error) {
        console.error('Error:', error);
        setResponse({ error: (error as Error).message });
        setStatus('idle');
        removeKey(pendingKey);
      }
    },
    [finishAsDone, pendingKey, pollAudioUntilReady]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await runGeneration(buildPayload());
    },
    [buildPayload, runGeneration]
  );

  useEffect(() => {
    if (!isLoaded || didHydrateDraftRef.current) return;
    didHydrateDraftRef.current = true;

    const saved = readJson<CreateDraft>(draftKey);
    if (!saved) return;
    if (!isFresh(saved.updatedAt, CREATE_DRAFT_TTL_MS)) {
      removeKey(draftKey);
      return;
    }

    setLanguage(saved.language || '');
    setRegion(saved.region || '');
    setLevel(saved.level || '');
    setFocus(saved.focus || '');
    setFocusMore(saved.focusMore || '');
    setTopic(saved.topic || '');
    setTopicMore(saved.topicMore || '');
    setCustomTopic(saved.customTopic || '');
    setShowMoreFocus(Boolean(saved.showMoreFocus));
    setShowMoreTopics(Boolean(saved.showMoreTopics));
    setDraftNotice('Recovered your draft.');
  }, [draftKey, isLoaded]);

  useEffect(() => {
    if (!didHydrateDraftRef.current) return;

    const draft: CreateDraft = {
      language,
      region,
      level,
      focus,
      focusMore,
      topic,
      topicMore,
      customTopic,
      showMoreFocus,
      showMoreTopics,
      updatedAt: Date.now(),
    };

    writeJson(draftKey, draft);
  }, [
    customTopic,
    draftKey,
    focus,
    focusMore,
    language,
    level,
    region,
    showMoreFocus,
    showMoreTopics,
    topic,
    topicMore,
  ]);

  useEffect(() => {
    if (!isLoaded || !user || didTryResumeRef.current) return;
    didTryResumeRef.current = true;

    const restore = async () => {
      const pending = readJson<PendingCreate>(pendingKey);
      if (!pending) return;

      if (!isFresh(pending.startedAt, CREATE_PENDING_TTL_MS)) {
        removeKey(pendingKey);
        return;
      }

      setResumeNotice('Resuming your previous story generation...');

      try {
        if (pending.storyId) {
          const check = await fetch(`/api/user-stories?id=${pending.storyId}`, { cache: 'no-store' });
          const json = (await check.json()) as { story?: GeneratedStory };
          if (json.story && isStory(json.story)) {
            setStatus('generating_audio');
            setResponse({ story: json.story });
            const ready = await pollAudioUntilReady(json.story);
            finishAsDone(ready);
            setResumeNotice('Recovered your generated story.');
            return;
          }
        }

        const recovered = await findRecoveredStory(pending);
        if (recovered) {
          setStatus('generating_audio');
          setResponse({ story: recovered });
          const ready = await pollAudioUntilReady(recovered);
          finishAsDone(ready);
          setResumeNotice('Recovered your generated story.');
          return;
        }

        removeKey(pendingKey);
        setStatus('idle');
        setResumeNotice('Previous generation was interrupted. You can generate again with your saved draft.');
      } catch {
        setStatus('idle');
        setResumeNotice('Could not resume automatically. Your draft is safe.');
      }
    };

    void restore();
  }, [findRecoveredStory, finishAsDone, isLoaded, pendingKey, pollAudioUntilReady, user]);

  if (!isLoaded) return null;

  if (plan !== 'polyglot') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center text-gray-300">
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
    <div className="max-w-3xl mx-auto py-12 px-4 text-gray-100">
      <div className="flex items-center gap-3 mb-8">
        <Sparkles className="h-7 w-7 text-white" />
        <h1 className="text-3xl font-bold text-white">Create a Story</h1>
      </div>

      {draftNotice ? (
        <div className="mb-4 rounded-lg border border-sky-500/40 bg-sky-900/20 px-4 py-3 text-sm text-sky-100">
          {draftNotice}
        </div>
      ) : null}

      {resumeNotice ? (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-100">
          {resumeNotice}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-[#0D1B2A] p-6 rounded-xl border border-gray-700"
      >
        <div>
          <label className="block text-sm text-gray-300 mb-1">Language</label>
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              setRegion('');
            }}
            required
            className="w-full rounded-md bg-[#1B263B] text-white p-2 focus:outline-none"
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
            <label className="block text-sm text-gray-300 mb-1">Region (optional)</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-md bg-[#1B263B] text-white p-2 focus:outline-none"
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
          <label className="block text-sm text-gray-300 mb-1">Level</label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            required
            className="w-full rounded-md bg-[#1B263B] text-white p-2 focus:outline-none"
          >
            <option value="">Select level</option>
            {levels.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Focus</label>
          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            required
            className="w-full rounded-md bg-[#1B263B] text-white p-2 focus:outline-none"
          >
            <option value="">Select focus</option>
            {focusCore.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowMoreFocus((v) => !v)}
            className="mt-2 text-xs text-sky-300 hover:text-sky-200"
          >
            {showMoreFocus ? 'Hide more focus options' : 'More focus options'}
          </button>
          {showMoreFocus && (
            <select
              value={focusMore}
              onChange={(e) => setFocusMore(e.target.value)}
              className="mt-2 w-full rounded-md bg-[#1B263B] text-white p-2 focus:outline-none"
            >
              <option value="">No extra focus</option>
              {focusExtended.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Topic</label>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
            className="w-full rounded-md bg-[#1B263B] text-white p-2 focus:outline-none"
          >
            <option value="">Select topic</option>
            {topicCore.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowMoreTopics((v) => !v)}
            className="mt-2 text-xs text-sky-300 hover:text-sky-200"
          >
            {showMoreTopics ? 'Hide more topic options' : 'More topic options'}
          </button>
          {showMoreTopics && (
            <select
              value={topicMore}
              onChange={(e) => setTopicMore(e.target.value)}
              className="mt-2 w-full rounded-md bg-[#1B263B] text-white p-2 focus:outline-none"
            >
              <option value="">No extra topic</option>
              {topicExtended.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">
            Custom topic (optional, max {CUSTOM_TOPIC_MAX} chars)
          </label>
          <input
            type="text"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value.slice(0, CUSTOM_TOPIC_MAX))}
            maxLength={CUSTOM_TOPIC_MAX}
            placeholder="e.g. Two coworkers negotiating deadlines in Berlin"
            className="w-full rounded-md bg-[#1B263B] text-white p-2 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400 text-right">
            {customTopic.length}/{CUSTOM_TOPIC_MAX}
          </p>
        </div>

        <button
          type="submit"
          disabled={status === 'generating_text' || status === 'generating_audio'}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md transition disabled:opacity-70"
        >
          {status === 'idle' && 'Generate Story'}
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
        </button>
      </form>

      {response?.story && status === 'done' && <StoryPreview story={response.story} />}

      {response?.error && (
        <div className="mt-8 border border-red-700 rounded-xl p-6 bg-red-900/40">
          <h2 className="text-lg font-semibold mb-2 text-red-400">Error</h2>
          <pre className="text-sm text-gray-200 whitespace-pre-wrap">{response.error}</pre>
        </div>
      )}
    </div>
  );
}

function StoryPreview({ story }: { story: GeneratedStory }) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);

  const handleWordClick = (word: string) => {
    const item = story.vocab?.find((v) => v.word === word);
    setSelectedWord(word);
    setDefinition(item?.definition ?? null);
  };

  const previewText = story.text ? `${story.text.split('</p>').slice(0, 1).join('</p>')}</p>` : '';

  return (
    <div className="mt-10 bg-[#1B263B] border border-gray-700 rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-2 text-white">{story.title}</h2>
      <p className="text-sm text-gray-400 mb-4">
        {formatLanguage(story.language || '')} • {formatLevel(story.level || '')} •{' '}
        {toTitleCase(story.region || 'General')}
      </p>

      <div className="relative">
        <StoryContent
          text={previewText}
          sentencesPerParagraph={3}
          renderWord={(word) => (
            <span
              onClick={() => handleWordClick(word)}
              className="vocab-word cursor-pointer text-yellow-300 hover:text-yellow-200"
            >
              {word}
            </span>
          )}
        />
        {selectedWord && (
          <VocabPanel
            story={story}
            initialWord={selectedWord}
            initialDefinition={definition}
            onClose={() => {
              setSelectedWord(null);
              setDefinition(null);
            }}
          />
        )}
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
