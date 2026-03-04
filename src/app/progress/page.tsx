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
  streakDays: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function motivationalLine(progress: ProgressPayload): string {
  if (progress.streakDays >= 7) return "Strong momentum. Keep the streak alive.";
  if (progress.weeklyMinutesListened >= progress.weeklyGoalMinutes) return "Weekly goal reached. Excellent consistency.";
  if (progress.minutesListened >= 120) return "You are building real listening endurance.";
  return "Small sessions add up. Keep going this week.";
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
    if (!progress.weeklyGoalMinutes) return 0;
    return clamp((progress.weeklyMinutesListened / progress.weeklyGoalMinutes) * 100, 0, 100);
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="rounded-2xl bg-[var(--card-bg)] p-5 border border-[var(--card-border)]">
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm mb-2">
            <Clock3 size={16} /> Minutes listened
          </div>
          <p className="text-3xl font-semibold">{progress.minutesListened}</p>
        </div>
        <div className="rounded-2xl bg-[var(--card-bg)] p-5 border border-[var(--card-border)]">
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm mb-2">
            <BookCheck size={16} /> Stories finished
          </div>
          <p className="text-3xl font-semibold">{progress.storiesFinished}</p>
        </div>
        <div className="rounded-2xl bg-[var(--card-bg)] p-5 border border-[var(--card-border)]">
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm mb-2">
            <BookOpenCheck size={16} /> Books finished
          </div>
          <p className="text-3xl font-semibold">{progress.booksFinished}</p>
        </div>
        <div className="rounded-2xl bg-[var(--card-bg)] p-5 border border-[var(--card-border)]">
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm mb-2">
            <Star size={16} /> Words learned
          </div>
          <p className="text-3xl font-semibold">{progress.wordsLearned}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--card-bg)] p-6 border border-[var(--card-border)]">
        <div className="flex items-center gap-2 text-[var(--muted)] text-sm mb-2">
          <Flame size={16} /> Weekly motivation
        </div>
        <p className="text-lg font-medium mb-4">{motivationalLine(progress)}</p>
        <p className="text-sm text-[var(--muted)] mb-2">
          {progress.weeklyMinutesListened} / {progress.weeklyGoalMinutes} min this week
        </p>
        <div className="h-2 rounded-full bg-[var(--card-bg-hover)] overflow-hidden mb-3">
          <div
            className="h-full bg-sky-400 transition-all"
            style={{ width: `${weeklyPercent}%` }}
          />
        </div>
        <p className="text-sm text-[var(--muted)]">Current streak: {progress.streakDays} day(s)</p>
      </div>
    </div>
  );
}
