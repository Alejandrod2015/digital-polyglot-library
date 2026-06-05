// Builds a real LifecycleData object for a user from their actual activity, so
// lifecycle emails carry the user's own stories, words and stats instead of the
// mock SAMPLE_STORIES defaults. Everything is defensive: any failure falls back
// to undefined so the email builder uses its own sane default.

import { prisma } from "@/lib/prisma";
import { getProgressPayloadCached } from "@/lib/progressPayload";
import { getCompletedJourneyStoryKeys } from "@/lib/journeyProgress";
import type { LifecycleData, VocabItem } from "@/lib/emails/lifecycle";

type StoryRow = {
  slug: string | null;
  title: string | null;
  level: string | null;
  coverUrl: string | null;
  synopsis: string | null;
  vocab: unknown;
  wordCount: number | null;
  journey: { language: string };
};

/** Email + signup timestamp from the signup_completed metric (no Clerk call). */
export async function resolveEmailAndSignup(
  userId: string
): Promise<{ email: string | null; signupAt: Date | null }> {
  try {
    const row = await prisma.userMetric.findFirst({
      where: { userId, eventType: "signup_completed" },
      select: { metadata: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const meta = (row?.metadata ?? {}) as { email?: string };
    let email = typeof meta.email === "string" ? meta.email : null;
    if (!email) {
      const pref = await prisma.emailPreference.findFirst({
        where: { userId },
        select: { email: true },
      });
      email = pref?.email ?? null;
    }
    return { email, signupAt: row?.createdAt ?? null };
  } catch {
    return { email: null, signupAt: null };
  }
}

function sortedByCount(counts: Map<string, number>): string[] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

/**
 * Candidate target languages, ordered best-first. Primary signal = the language
 * of the stories the user actually consumes (far more reliable than saved-word
 * language: a user often saves words in one language but reads in another).
 * Favorites are appended as a fallback. The caller tries each until one has
 * published content. Lowercased to match Journey.language.
 */
async function resolveLanguageCandidates(userId: string): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (langs: string[]) => {
    for (const l of langs) if (l && !seen.has(l)) (seen.add(l), out.push(l));
  };

  // 1. By consumed stories.
  try {
    const metrics = await prisma.userMetric.findMany({
      where: {
        userId,
        eventType: { in: ["audio_complete", "continue_listening"] },
        storySlug: { not: "" },
      },
      select: { storySlug: true },
      take: 300,
    });
    const slugs = [...new Set(metrics.map((m) => m.storySlug).filter(Boolean))];
    if (slugs.length) {
      const stories = await prisma.journeyStory.findMany({
        where: { slug: { in: slugs } },
        select: { journey: { select: { language: true } } },
      });
      const counts = new Map<string, number>();
      for (const s of stories) {
        const l = s.journey?.language?.trim().toLowerCase();
        if (l) counts.set(l, (counts.get(l) ?? 0) + 1);
      }
      add(sortedByCount(counts));
    }
  } catch {
    /* ignore */
  }

  // 2. By saved-word language.
  try {
    const rows = await prisma.favorite.findMany({
      where: { userId, language: { not: null } },
      select: { language: true },
    });
    const counts = new Map<string, number>();
    for (const r of rows) {
      const l = r.language?.trim().toLowerCase();
      if (l) counts.set(l, (counts.get(l) ?? 0) + 1);
    }
    add(sortedByCount(counts));
  } catch {
    /* ignore */
  }

  return out;
}

/** The user's recent saved words, newest first. */
async function resolveVocab(
  userId: string,
  weekStart?: Date
): Promise<{ all: VocabItem[]; weekWords: string[] }> {
  try {
    const rows = await prisma.favorite.findMany({
      where: { userId },
      select: { word: true, translation: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    const all = rows.map((r) => ({ word: r.word, definition: r.translation }));
    const weekWords = weekStart
      ? rows.filter((r) => r.createdAt >= weekStart).map((r) => r.word)
      : rows.map((r) => r.word);
    return { all, weekWords };
  } catch {
    return { all: [], weekWords: [] };
  }
}

function toVocabItems(vocab: unknown): VocabItem[] {
  if (!Array.isArray(vocab)) return [];
  return vocab
    .filter(
      (v): v is { word: string; definition: string } =>
        !!v && typeof v.word === "string" && typeof v.definition === "string"
    )
    .map((v) => ({ word: v.word, definition: v.definition }));
}

function storyToRef(s: StoryRow) {
  return {
    id: s.slug ?? undefined,
    title: s.title ?? "",
    level: (s.level ?? "").toUpperCase() || undefined,
    minutes: s.wordCount ? Math.max(2, Math.round(s.wordCount / 120)) : 4,
    coverUrl: s.coverUrl ?? "",
    synopsis: s.synopsis ?? undefined,
    vocab: toVocabItems(s.vocab),
  };
}

async function publishedStoriesForLanguage(language?: string): Promise<StoryRow[]> {
  return (await prisma.journeyStory.findMany({
    where: {
      status: "published",
      title: { not: null },
      slug: { not: null },
      coverUrl: { not: null },
      ...(language
        ? { journey: { language: { equals: language, mode: "insensitive" as const } } }
        : {}),
    },
    select: {
      slug: true,
      title: true,
      level: true,
      coverUrl: true,
      synopsis: true,
      vocab: true,
      wordCount: true,
      journey: { select: { language: true } },
    },
    orderBy: [{ level: "asc" }, { slotIndex: "asc" }],
    take: 6,
  })) as StoryRow[];
}

/** Published stories for the first candidate language that actually has content. */
async function resolveStories(candidates: string[]): Promise<StoryRow[]> {
  try {
    for (const lang of candidates) {
      const rows = await publishedStoriesForLanguage(lang);
      if (rows.length) return rows;
    }
    // No candidate matched (or none known): any published content as last resort.
    return await publishedStoriesForLanguage(undefined);
  } catch {
    return [];
  }
}

/** The user's most recent in-progress (or just-finished) story, with %. */
async function resolveCurrentStory(
  userId: string
): Promise<{ slug: string; pct: number; minutesLeft: number } | null> {
  try {
    const row = await prisma.continueListeningEntry.findFirst({
      where: { userId },
      select: { storySlug: true, progressSec: true, audioDurationSec: true },
      orderBy: { lastPlayedAt: "desc" },
    });
    if (!row?.storySlug) return null;
    const dur = row.audioDurationSec ?? 0;
    const prog = row.progressSec ?? 0;
    const pct = dur > 0 ? Math.min(100, Math.round((prog / dur) * 100)) : 0;
    const minutesLeft = dur > 0 ? Math.max(1, Math.round((dur - prog) / 60)) : 2;
    return { slug: row.storySlug, pct, minutesLeft };
  } catch {
    return null;
  }
}

/**
 * Assemble a real LifecycleData for a user. Fields left undefined fall back to
 * the builder's own defaults, so a partially-known user still gets a sane email.
 */
export async function buildLifecycleData(userId: string): Promise<LifecycleData> {
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [candidates, progress, vocab, completedKeys] = await Promise.all([
    resolveLanguageCandidates(userId),
    getProgressPayloadCached(userId).catch(() => null),
    resolveVocab(userId, weekStart),
    getCompletedJourneyStoryKeys(userId).catch(() => new Set<string>()),
  ]);

  const [stories, current] = await Promise.all([
    resolveStories(candidates),
    resolveCurrentStory(userId),
  ]);

  // Slugs the user has already finished (canonical 95% rule). Keys look like
  // "standalone:slug" or "book:slug", so the last segment is the slug.
  const completedSlugs = new Set(
    [...completedKeys].map((k) => k.split(":").pop()).filter(Boolean) as string[]
  );

  // The story the user is currently in (half-finished or just finished).
  const currentRow = current ? stories.find((s) => s.slug === current.slug) : undefined;
  // For welcome/next, the "first story" is the first one NOT yet finished.
  const firstUnfinished = stories.find((s) => s.slug && !completedSlugs.has(s.slug));
  const firstStoryBase = currentRow ?? firstUnfinished ?? stories[0];
  const firstStory = firstStoryBase
    ? {
        ...storyToRef(firstStoryBase),
        // prefer the user's own saved words for the glossary if we have them
        vocab:
          vocab.all.length >= 3 ? vocab.all.slice(0, 3) : storyToRef(firstStoryBase).vocab,
        percentRead: current?.pct,
        minutesLeft: current?.minutesLeft,
      }
    : undefined;

  // Next stories = list minus the current one AND minus anything already finished.
  const nextStories = stories
    .filter((s) => s.slug !== firstStoryBase?.slug)
    .filter((s) => !s.slug || !completedSlugs.has(s.slug))
    .map(storyToRef);

  const data: LifecycleData = {};

  if (firstStory && firstStory.coverUrl) data.firstStory = firstStory;
  if (nextStories.length) data.nextStories = nextStories;

  if (progress) {
    data.stats = {
      wordsSeen: firstStory?.vocab?.length
        ? Math.max(firstStory.vocab.length, progress.wordsLearned)
        : progress.wordsLearned || undefined,
      storiesCount: progress.storiesFinished || undefined,
      wordsCount: progress.wordsLearned || undefined,
      daysActive: progress.streakDays || undefined,
      weekWords: vocab.weekWords.length ? vocab.weekWords.slice(0, 12) : undefined,
    };
  }

  return data;
}
