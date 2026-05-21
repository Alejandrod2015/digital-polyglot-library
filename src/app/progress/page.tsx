"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { BookCheck, Crosshair, Flame, Headphones, Star, Trophy, Zap } from "lucide-react";

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
  gamification: {
    totalXp: number;
    todayXp: number;
    weeklyXp: number;
    currentLevel: number;
    levelStartXp: number;
    nextLevelXp: number;
    levelProgress: number;
    dailyStreak: number;
    quests: Array<{
      id: string;
      label: string;
      current: number;
      target: number;
      rewardXp: number;
      complete: boolean;
    }>;
    badges: Array<{
      id: string;
      label: string;
      description: string;
      unlocked: boolean;
      accent: string;
    }>;
  };
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
  unlocked?: boolean;
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
    const progressMap: Record<string, { current: number; target: number }> = {
      first_story: { current: progress.storiesFinished, target: 1 },
      week_streak: { current: progress.storyStreakDays, target: 7 },
      word_collector: { current: progress.wordsLearned, target: 25 },
      practice_ten: { current: progress.practiceSessionsCompleted, target: 10 },
      region_explorer: { current: progress.regionsExplored, target: 3 },
    };

    return progress.gamification.badges.map((badge) => ({
      label: badge.label,
      description: badge.description,
      current: progressMap[badge.id]?.current ?? 0,
      target: progressMap[badge.id]?.target ?? 1,
      accent: badge.accent,
      unlocked: badge.unlocked,
    }));
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

  // Week label "Week 21 · 2026" — ISO week number + current year.
  // Used in the iPhone-style top-right tag.
  const now = new Date();
  const weekNumber = (() => {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  })();

  // Ring geometry (220px outer, 200px inner).
  const ringSize = 220;
  const ringR = 100;
  const ringC = 2 * Math.PI * ringR;
  const ringDash = (Math.max(0, Math.min(1, progress.gamification.levelProgress)) * ringC);

  const levelXpNow = progress.gamification.totalXp - progress.gamification.levelStartXp;
  const levelXpMax = progress.gamification.nextLevelXp - progress.gamification.levelStartXp;
  const weeklyStoriesPercent = weeklyPercent;
  const totalXpDisplay = progress.gamification.totalXp >= 1000
    ? `${(progress.gamification.totalXp / 1000).toFixed(1).replace(".", ",")}`
    : `${progress.gamification.totalXp}`;

  return (
    <div className="px-5 pb-24 pt-8 sm:px-8 mx-auto text-[var(--foreground)]" style={{ maxWidth: 480 }}>
      {/* ── Top row: PROGRESS eyebrow + Week tag ── */}
      <div className="flex items-baseline justify-between mb-6">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.32em] text-white/55">Progress</p>
        <span className="text-[13px] font-bold text-white/75">
          Week {weekNumber} · {now.getFullYear()}
        </span>
      </div>

      {/* ── Ring with day streak in the center ── */}
      <div className="flex justify-center mb-6">
        <div className="relative" style={{ width: ringSize, height: ringSize }}>
          {/* Soft outer halo */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: "0 0 60px rgba(190, 242, 100, 0.18), 0 0 120px rgba(190, 242, 100, 0.08)",
            }}
          />
          <svg
            width={ringSize}
            height={ringSize}
            className="absolute inset-0"
            style={{ transform: "rotate(-90deg)" }}
            aria-hidden
          >
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringR}
              fill="rgba(11, 30, 58, 0.5)"
              stroke="rgba(190, 242, 100, 0.15)"
              strokeWidth={6}
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringR}
              fill="none"
              stroke="#bef264"
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={`${ringDash} ${ringC}`}
              style={{ filter: "drop-shadow(0 0 8px rgba(190,242,100,0.5))" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-white font-black leading-none" style={{ fontSize: 72 }}>
              {progress.gamification.dailyStreak}
            </span>
            <div className="mt-2 inline-flex items-center gap-1.5 text-[#fb923c] text-[13px] font-extrabold tracking-[0.18em]">
              <Zap size={13} fill="currentColor" strokeWidth={0} />
              DAY STREAK
            </div>
          </div>
        </div>
      </div>

      {/* ── Level chip ── */}
      <div className="flex justify-center mb-7">
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5"
          style={{
            background: "rgba(190, 242, 100, 0.08)",
            border: "1px solid rgba(190, 242, 100, 0.35)",
          }}
        >
          <Zap size={14} fill="#bef264" strokeWidth={0} />
          <span className="text-[#bef264] font-extrabold text-[13px] tracking-[0.14em]">
            LEVEL {progress.gamification.currentLevel} · {levelXpNow}/{levelXpMax} XP
          </span>
        </div>
      </div>

      {/* ── 2×2 stat grid ── */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-[20px] border border-white/8 bg-white/[0.025] p-4">
          <div className="flex items-center gap-1.5 mb-2 text-[#bef264] text-[11px] font-extrabold uppercase tracking-[0.18em]">
            <Zap size={11} fill="currentColor" strokeWidth={0} />
            Total XP
          </div>
          <p className="text-white text-[34px] font-black leading-none">{totalXpDisplay}</p>
          <p className="mt-1 text-white/55 text-[12px]">+{progress.gamification.todayXp} today</p>
        </div>

        <div className="rounded-[20px] border border-white/8 bg-white/[0.025] p-4">
          <div className="flex items-center gap-1.5 mb-2 text-[#7dd3fc] text-[11px] font-extrabold uppercase tracking-[0.18em]">
            <Crosshair size={11} />
            Accuracy
          </div>
          <p className="text-white text-[34px] font-black leading-none">{progress.practiceAccuracy}%</p>
          <p className="mt-1 text-white/55 text-[12px]">
            {progress.practiceSessionsCompleted} session{progress.practiceSessionsCompleted === 1 ? "" : "s"}
          </p>
        </div>

        <div className="rounded-[20px] border border-white/8 bg-white/[0.025] p-4">
          <div className="flex items-center gap-1.5 mb-2 text-[#a78bfa] text-[11px] font-extrabold uppercase tracking-[0.18em]">
            <BookCheck size={11} />
            Words
          </div>
          <p className="text-white text-[34px] font-black leading-none">{progress.wordsLearned}</p>
          <p className="mt-1 text-white/55 text-[12px]">learned all-time</p>
        </div>

        <div className="rounded-[20px] border border-white/8 bg-white/[0.025] p-4">
          <div className="flex items-center gap-1.5 mb-2 text-[#fcd34d] text-[11px] font-extrabold uppercase tracking-[0.18em]">
            <Headphones size={11} />
            Minutes
          </div>
          <p className="text-white text-[34px] font-black leading-none">{progress.minutesListened}</p>
          <p className="mt-1 text-white/55 text-[12px]">
            {progress.storiesFinished} {progress.storiesFinished === 1 ? "story" : "stories"}
          </p>
        </div>
      </div>

      {/* ── This week ── */}
      <div className="rounded-[20px] border border-white/8 bg-white/[0.025] p-4 mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[#7dd3fc] text-[11px] font-extrabold uppercase tracking-[0.22em]">This week</p>
          <span className="text-white/55 text-[12px]">Resets Sun</span>
        </div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="inline-flex items-center gap-2 text-white font-extrabold text-[15px]">
            <span className="text-[#bef264] text-lg leading-none">+</span> Stories
          </span>
          <span className="text-[15px] font-extrabold">
            <span className="text-[#bef264]">{progress.weeklyStoriesFinished}</span>
            <span className="text-white/55"> / {progress.weeklyGoalStories}</span>
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-white/8">
          <div
            className="h-full rounded-full"
            style={{
              width: `${weeklyStoriesPercent}%`,
              background: "linear-gradient(90deg, #bef264, #a3e635)",
            }}
          />
        </div>

        <div className="flex items-baseline justify-between mb-1.5 mt-4">
          <span className="inline-flex items-center gap-2 text-white font-extrabold text-[15px]">
            <span className="text-[#fcd34d] text-lg leading-none">♪</span> Minutes
          </span>
          <span className="text-[15px] font-extrabold">
            <span className="text-[#fcd34d]">{progress.weeklyMinutesListened}</span>
            <span className="text-white/55"> / {progress.weeklyGoalMinutes}</span>
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-white/8">
          <div
            className="h-full rounded-full"
            style={{
              width: `${clamp((progress.weeklyMinutesListened / Math.max(1, progress.weeklyGoalMinutes)) * 100, 0, 100)}%`,
              background: "linear-gradient(90deg, #fcd34d, #f59e0b)",
            }}
          />
        </div>

        <div className="flex items-baseline justify-between mb-1.5 mt-4">
          <span className="inline-flex items-center gap-2 text-white font-extrabold text-[15px]">
            <span className="text-[#7dd3fc] text-lg leading-none">◎</span> Practice
          </span>
          <span className="text-[15px] font-extrabold">
            <span className="text-[#7dd3fc]">{progress.weeklyPracticeSessions}</span>
            <span className="text-white/55"> / {progress.weeklyGoalPracticeSessions}</span>
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-white/8">
          <div
            className="h-full rounded-full"
            style={{
              width: `${clamp((progress.weeklyPracticeSessions / Math.max(1, progress.weeklyGoalPracticeSessions)) * 100, 0, 100)}%`,
              background: "linear-gradient(90deg, #7dd3fc, #38bdf8)",
            }}
          />
        </div>
      </div>

      {/* ── Daily quests (kept; styled compact below the week stats) ── */}
      {progress.gamification.quests.length > 0 ? (
        <div className="rounded-[20px] border border-white/8 bg-white/[0.025] p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-white text-[14px] font-extrabold">
              <Trophy size={15} className="text-[#fcd34d]" />
              Daily quests
            </div>
            <span className="text-white/55 text-[12px] font-bold">
              {progress.gamification.quests.filter((q) => q.complete).length} / {progress.gamification.quests.length}
            </span>
          </div>
          <div className="space-y-2">
            {progress.gamification.quests.map((quest) => (
              <div
                key={quest.id}
                className="rounded-[14px] border border-white/6 bg-black/20 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-bold text-white">{quest.label}</p>
                  <span className="text-[11px] font-extrabold text-[#bef264]">
                    +{quest.rewardXp} XP
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/55">
                  <span>
                    {Math.min(quest.current, quest.target)} / {quest.target}
                  </span>
                  <span>{quest.complete ? "Done" : "In progress"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Achievements (compact) ── */}
      {achievements.length > 0 ? (
        <div className="rounded-[20px] border border-white/8 bg-white/[0.025] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-white text-[14px] font-extrabold">
              <Star size={15} className="text-[#fcd34d]" fill="currentColor" />
              Achievements
            </div>
          </div>
          <div className="space-y-2">
            {achievements.map((achievement) => {
              const percent = clamp((achievement.current / achievement.target) * 100, 0, 100);
              return (
                <div
                  key={achievement.label}
                  className="flex items-center gap-3 rounded-[14px] border border-white/6 bg-black/20 px-3 py-2.5"
                >
                  <div
                    className="grid place-items-center shrink-0"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: achievement.accent,
                    }}
                  >
                    <Flame size={18} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-bold text-white truncate">{achievement.label}</p>
                      <span className="text-[11px] font-bold text-white/55">
                        {Math.min(achievement.current, achievement.target)}/{achievement.target}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/8 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${percent}%`, backgroundColor: achievement.accent }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Tiny line at the bottom — keeps the existing motivational copy. */}
      <p className="mt-6 text-center text-[13px] text-white/55">{motivationalLine(progress)}</p>
    </div>
  );
}
