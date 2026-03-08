"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { BookCheck, BookOpenCheck, Clock3, Flame, Star } from "lucide-react";

type ProgressPayload = {
  minutesListened: number;
  storiesFinished: number;
  booksFinished: number;
  wordsLearned: number;
  weeklyGoalMinutes: number;
  weeklyMinutesListened: number;
  weeklyGoalStories: number;
  weeklyStoriesFinished: number;
  monthlyStoriesFinished: number;
  storyStreakDays: number;
  regionsExplored: number;
  streakDays: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function motivationalLine(progress: ProgressPayload): string {
  if (progress.storyStreakDays >= 7) return "Your reading habit is real now. Protect the streak.";
  if (progress.weeklyStoriesFinished >= progress.weeklyGoalStories) return "Weekly story goal reached. Strong consistency.";
  if (progress.regionsExplored >= 3) return "You are expanding your atlas, not just finishing stories.";
  return "One finished story a day is enough to keep momentum.";
}

export default function ProgressPage() {
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) {
        if (!cancelled) {
          setLoading(false);
          setProgress(null);
        }
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/progress", { cache: "no-store" });
        const data = (await res.json()) as ProgressPayload & { error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to load progress.");
        if (!cancelled) setProgress(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load progress.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (isLoaded) void run();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, user]);

  const weeklyPercent = useMemo(() => {
    if (!progress) return 0;
    if (!progress.weeklyGoalStories) return 0;
    return clamp((progress.weeklyStoriesFinished / progress.weeklyGoalStories) * 100, 0, 100);
  }, [progress]);

  if (!isLoaded || loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-[var(--foreground)]">
        <h1 className="text-3xl font-bold mb-6">Your Progress</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 animate-pulse h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-[var(--foreground)]">
        <h1 className="text-3xl font-bold mb-4">Your Progress</h1>
        <p className="text-[var(--muted)] mb-4">Sign in to track your listening and reading milestones.</p>
        <Link
          href="/sign-in"
          className="inline-flex rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-[var(--foreground)]">
        <h1 className="text-3xl font-bold mb-4">Your Progress</h1>
        <p className="text-red-300">{error || "Could not load progress right now."}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto text-[var(--foreground)]">
      <h1 className="text-3xl font-bold mb-6">Your Progress</h1>

      <div className="rounded-2xl bg-[var(--card-bg)] p-6 border border-[var(--card-border)] mb-6">
        <div className="flex items-center gap-2 text-[var(--muted)] text-sm mb-2">
          <Flame size={16} /> Story streak
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-5xl font-semibold leading-none">{progress.storyStreakDays}</p>
            <p className="text-sm text-[var(--muted)] mt-2">
              {progress.storyStreakDays === 1 ? "day in a row" : "days in a row"} with a finished story
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--muted)] mb-1">This week</p>
            <p className="text-lg font-medium">
              {progress.weeklyStoriesFinished} / {progress.weeklyGoalStories} stories
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="rounded-2xl bg-[var(--card-bg)] p-5 border border-[var(--card-border)]">
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm mb-2">
            <BookCheck size={16} /> Stories finished
          </div>
          <p className="text-3xl font-semibold">{progress.storiesFinished}</p>
        </div>
        <div className="rounded-2xl bg-[var(--card-bg)] p-5 border border-[var(--card-border)]">
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm mb-2">
            <Clock3 size={16} /> Minutes listened
          </div>
          <p className="text-3xl font-semibold">{progress.minutesListened}</p>
        </div>
        <div className="rounded-2xl bg-[var(--card-bg)] p-5 border border-[var(--card-border)]">
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm mb-2">
            <BookOpenCheck size={16} /> This month
          </div>
          <p className="text-3xl font-semibold">{progress.monthlyStoriesFinished}</p>
        </div>
        <div className="rounded-2xl bg-[var(--card-bg)] p-5 border border-[var(--card-border)]">
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm mb-2">
            <Star size={16} /> Regions explored
          </div>
          <p className="text-3xl font-semibold">{progress.regionsExplored}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl bg-[var(--card-bg)] p-6 border border-[var(--card-border)]">
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm mb-2">
            <Flame size={16} /> Weekly story goal
          </div>
          <p className="text-lg font-medium mb-4">{motivationalLine(progress)}</p>
          <p className="text-sm text-[var(--muted)] mb-2">
            {progress.weeklyStoriesFinished} / {progress.weeklyGoalStories} stories this week
          </p>
          <div className="h-2 rounded-full bg-[var(--card-bg-hover)] overflow-hidden mb-3">
            <div
              className="h-full bg-sky-400 transition-all"
              style={{ width: `${weeklyPercent}%` }}
            />
          </div>
          <p className="text-sm text-[var(--muted)]">
            Listening this week: {progress.weeklyMinutesListened} / {progress.weeklyGoalMinutes} min
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--card-bg)] p-6 border border-[var(--card-border)]">
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm mb-3">
            <BookOpenCheck size={16} /> Milestones
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Books finished</span>
              <span className="font-medium">{progress.booksFinished}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Words saved</span>
              <span className="font-medium">{progress.wordsLearned}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Any activity streak</span>
              <span className="font-medium">{progress.streakDays} day(s)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
