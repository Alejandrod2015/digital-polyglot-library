"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { BookCheck, BookOpenCheck, BrainCircuit, Clock3, Flame, Star, Trophy } from "lucide-react";

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
  practiceSessionsCompleted: number;
  weeklyPracticeSessions: number;
  weeklyGoalPracticeSessions: number;
  practiceAccuracy: number;
  practiceStreakDays: number;
  streakDays: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function motivationalLine(progress: ProgressPayload): string {
  if (progress.storyStreakDays >= 7) return "Your reading habit is real now. Protect the streak.";
  if (progress.practiceStreakDays >= 3) return "Practice is compounding now. Keep the rhythm going.";
  if (progress.weeklyStoriesFinished >= progress.weeklyGoalStories) return "Weekly story goal reached. Strong consistency.";
  if (progress.regionsExplored >= 3) return "You are expanding your learning journey, not just finishing stories.";
  return "One finished story a day is enough to keep momentum.";
}

function motivationalBadge(progress: ProgressPayload): string {
  if (progress.storyStreakDays >= 14) return "Strong streak";
  if (progress.storyStreakDays >= 7) return "On a roll";
  if (progress.weeklyPracticeSessions >= progress.weeklyGoalPracticeSessions) return "Practice locked in";
  if (progress.weeklyStoriesFinished >= progress.weeklyGoalStories) return "Goal reached";
  return "Keep going";
}

function statLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

type Achievement = {
  label: string;
  description: string;
  current: number;
  target: number;
  accent: string;
};

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

  const achievements = useMemo<Achievement[]>(() => {
    if (!progress) return [];
    return [
      {
        label: "Wildfire",
        description: "Reach a 7-day story streak",
        current: progress.storyStreakDays,
        target: 7,
        accent: "bg-[#ff8a5b]",
      },
      {
        label: "Pathfinder",
        description: "Explore 3 regions",
        current: progress.regionsExplored,
        target: 3,
        accent: "bg-[#4bb7ff]",
      },
      {
        label: "Collector",
        description: "Save 25 useful words",
        current: progress.wordsLearned,
        target: 25,
        accent: "bg-[#7ad67f]",
      },
      {
        label: "Sharpener",
        description: "Complete 10 practice sessions",
        current: progress.practiceSessionsCompleted,
        target: 10,
        accent: "bg-[#a78bfa]",
      },
    ];
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
    <div className="px-5 pb-24 pt-8 sm:px-8 max-w-6xl mx-auto text-[var(--foreground)]">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-200/70">Progress</p>
          <h1 className="text-3xl font-bold sm:text-4xl">Your Progress</h1>
        </div>
        <div className="hidden rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs font-semibold text-sky-100 sm:inline-flex">
          {motivationalBadge(progress)}
        </div>
      </div>

      <div className="mb-4 rounded-[30px] border border-[#26425f] bg-[linear-gradient(180deg,#16304f_0%,#132947_100%)] p-5 shadow-[0_18px_55px_rgba(6,17,38,0.34)] sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[26px] border border-[#34516f] bg-[linear-gradient(180deg,#274b74_0%,#1b3557_100%)] p-5">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
              <Flame size={14} className="text-[#ffd36b]" />
              Story streak
            </div>
            <div className="flex items-end gap-3">
              <span className="text-6xl font-bold leading-none sm:text-7xl">{progress.storyStreakDays}</span>
              <span className="pb-1 text-sm font-medium text-slate-300 sm:text-base">
                {progress.storyStreakDays === 1 ? "day in a row" : "days in a row"}
              </span>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200/90 sm:text-base">{motivationalLine(progress)}</p>
            <div className="mt-4 inline-flex rounded-full border border-[#3b6291] bg-[#21466d] px-3 py-1 text-xs font-bold text-[#d7efff]">
              {motivationalBadge(progress)}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[24px] border border-[#34516f] bg-[#18314d] p-4">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                <span>Weekly goal</span>
                <span>{progress.weeklyStoriesFinished} / {progress.weeklyGoalStories}</span>
              </div>
              <div className="mb-2 h-3 rounded-full bg-[#314861] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#71dd5a,#3dc55d)] transition-all"
                  style={{ width: `${weeklyPercent}%` }}
                />
              </div>
              <p className="text-sm font-medium text-slate-100">
                {statLabel(progress.weeklyStoriesFinished, "story", "stories")} finished this week
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Listening: {progress.weeklyMinutesListened} / {progress.weeklyGoalMinutes} min
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Practice: {progress.weeklyPracticeSessions} / {progress.weeklyGoalPracticeSessions} sessions
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[22px] border border-[#34516f] bg-[#18314d] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">This month</p>
                <p className="mt-2 text-3xl font-bold">{progress.monthlyStoriesFinished}</p>
                <p className="mt-1 text-xs text-slate-300">stories finished</p>
              </div>
              <div className="rounded-[22px] border border-[#34516f] bg-[#18314d] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Regions</p>
                <p className="mt-2 text-3xl font-bold">{progress.regionsExplored}</p>
                <p className="mt-1 text-xs text-slate-300">regions explored</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[22px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <BookCheck size={15} /> Stories finished
          </div>
          <p className="text-3xl font-bold">{progress.storiesFinished}</p>
        </div>

        <div className="rounded-[22px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <Clock3 size={15} /> Minutes listened
          </div>
          <p className="text-3xl font-bold">{progress.minutesListened}</p>
        </div>

        <div className="rounded-[22px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <BookOpenCheck size={15} /> Books finished
          </div>
          <p className="text-3xl font-bold">{progress.booksFinished}</p>
        </div>

        <div className="rounded-[22px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <Star size={15} /> Words saved
          </div>
          <p className="text-3xl font-bold">{progress.wordsLearned}</p>
        </div>

        <div className="rounded-[22px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <BrainCircuit size={15} /> Practice sessions
          </div>
          <p className="text-3xl font-bold">{progress.practiceSessionsCompleted}</p>
          <p className="mt-1 text-xs text-slate-300">
            {progress.practiceAccuracy}% average accuracy
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-[26px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Trophy size={18} className="text-[#ffd36b]" />
            Achievements
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Keep climbing</div>
        </div>

        <div className="space-y-3">
          {achievements.map((achievement) => {
            const percent = clamp((achievement.current / achievement.target) * 100, 0, 100);
            return (
              <div
                key={achievement.label}
                className="grid items-center gap-3 rounded-[20px] border border-[#334860] bg-[var(--bg-content)] p-3 sm:grid-cols-[72px_1fr_auto]"
              >
                <div className={`flex h-[72px] w-[72px] items-center justify-center rounded-[18px] ${achievement.accent} shadow-[inset_0_-4px_0_rgba(0,0,0,0.15)]`}>
                  <Flame size={28} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-bold">{achievement.label}</p>
                    <span className="text-sm font-semibold text-slate-300">
                      {Math.min(achievement.current, achievement.target)} / {achievement.target}
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-slate-300">{achievement.description}</p>
                  <div className="h-3 rounded-full bg-[#334860] overflow-hidden">
                    <div className={`h-full rounded-full ${achievement.accent}`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
                <div className="hidden text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 sm:block">
                  {percent >= 100 ? "Done" : `${Math.round(percent)}%`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
