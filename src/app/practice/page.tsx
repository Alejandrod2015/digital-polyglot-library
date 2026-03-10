"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import {
  buildPracticeSession,
  getDuePracticeItems,
  getSpeechSynthesisLang,
  PracticeExercise,
  PracticeFavoriteItem,
  PracticeMode,
} from "@/lib/practiceExercises";

type LoadState = "loading" | "ready" | "error";

const matchColorClasses = [
  "border-sky-400 bg-sky-400/18 text-sky-100",
  "border-emerald-400 bg-emerald-400/18 text-emerald-100",
  "border-amber-300 bg-amber-300/18 text-amber-100",
  "border-fuchsia-400 bg-fuchsia-400/18 text-fuchsia-100",
  "border-cyan-300 bg-cyan-300/18 text-cyan-100",
  "border-rose-400 bg-rose-400/18 text-rose-100",
];

function getCompletionTone(score: number, total: number) {
  const ratio = total > 0 ? score / total : 0;

  if (ratio === 1) {
    return {
      badge: "Perfect session",
      line: "You cleared every prompt. Keep the momentum going.",
      accent: "from-emerald-400/35 via-teal-300/25 to-transparent",
      scoreColor: "text-emerald-300",
      pill: "border-emerald-300/35 bg-emerald-300/14 text-emerald-100",
    };
  }

  if (ratio >= 0.8) {
    return {
      badge: "Strong session",
      line: "Your review is holding up well. One more round would lock it in.",
      accent: "from-sky-400/30 via-cyan-300/20 to-transparent",
      scoreColor: "text-sky-300",
      pill: "border-sky-300/35 bg-sky-300/14 text-sky-100",
    };
  }

  if (ratio >= 0.6) {
    return {
      badge: "Good progress",
      line: "You are moving in the right direction. Another short set will help.",
      accent: "from-amber-300/30 via-yellow-200/20 to-transparent",
      scoreColor: "text-amber-200",
      pill: "border-amber-200/35 bg-amber-200/14 text-amber-50",
    };
  }

  return {
    badge: "Keep going",
    line: "This was still useful. A second round now will feel much easier.",
    accent: "from-rose-300/28 via-pink-200/18 to-transparent",
    scoreColor: "text-rose-200",
    pill: "border-rose-200/35 bg-rose-200/12 text-rose-50",
  };
}

export default function PracticePage() {
  const { user, isLoaded } = useUser();
  const [favorites, setFavorites] = useState<PracticeFavoriteItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [selectedMode, setSelectedMode] = useState<PracticeMode | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [matchAnswers, setMatchAnswers] = useState<Record<string, string>>({});
  const [activeMatchWord, setActiveMatchWord] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [streak, setStreak] = useState(0);
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setFavorites([]);
      setLoadState("ready");
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoadState("loading");
        const res = await fetch("/api/favorites", { cache: "no-store" });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as PracticeFavoriteItem[];
        if (!cancelled) {
          setFavorites(Array.isArray(data) ? data : []);
          setLoadState("ready");
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setFavorites([]);
          setLoadState("error");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, user]);

  const exercises = useMemo(
    () => (selectedMode ? buildPracticeSession(favorites, selectedMode) : []),
    [favorites, selectedMode]
  );
  const currentExercise = exercises[exerciseIndex] ?? null;
  const dueCount = useMemo(() => getDuePracticeItems(favorites).length, [favorites]);
  const revealed = currentExercise ? revealedIds.includes(currentExercise.id) : false;
  const activeSession = selectedMode !== null;
  const completedExerciseCount = sessionComplete ? exercises.length : revealedIds.length;
  const progressPercent =
    exercises.length > 0 ? Math.min(100, (completedExerciseCount / exercises.length) * 100) : 0;
  const matchSolvedPerfectly =
    currentExercise?.type === "match_meaning" &&
    revealed &&
    currentExercise.pairs.every((pair) => matchAnswers[pair.word] === pair.answer);

  const openSession = useCallback((mode: PracticeMode) => {
    if (typeof window !== "undefined") {
      window.history.pushState({ practiceSession: true }, "", window.location.href);
    }
    setSelectedMode(mode);
  }, []);

  const closeSession = useCallback(() => {
    if (typeof window !== "undefined" && window.history.state?.practiceSession) {
      window.history.back();
      return;
    }
    setSelectedMode(null);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.dataset.practiceActive = activeSession ? "true" : "false";
    window.dispatchEvent(new Event("practice-session-visibility-change"));
    return () => {
      document.body.dataset.practiceActive = "false";
      window.dispatchEvent(new Event("practice-session-visibility-change"));
    };
  }, [activeSession]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeSession) return;

    const handlePopState = () => {
      setSelectedMode(null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [activeSession]);

  useEffect(() => {
    setExerciseIndex(0);
    setSelectedOption(null);
    setMatchAnswers({});
    setActiveMatchWord(null);
    setRevealedIds([]);
    setScore(0);
    setSessionComplete(false);
    setStreak(0);
    setLastResult(null);
  }, [selectedMode, favorites.length]);

  useEffect(() => {
    setSelectedOption(null);
    setMatchAnswers({});
    setActiveMatchWord(null);
    setLastResult(null);
  }, [exerciseIndex]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeSession) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeSession, exerciseIndex, sessionComplete]);

  const revealCurrent = () => {
    if (!currentExercise) return;
    setRevealedIds((prev) => (prev.includes(currentExercise.id) ? prev : [...prev, currentExercise.id]));

    const isCorrect =
      currentExercise.type === "match_meaning"
        ? currentExercise.pairs.every((pair) => matchAnswers[pair.word] === pair.answer)
        : selectedOption === currentExercise.answer;

    if (isCorrect) {
      setScore((prev) => prev + 1);
      setStreak((prev) => prev + 1);
      setLastResult("correct");
    } else {
      setStreak(0);
      setLastResult("wrong");
    }
  };

  const goNext = () => {
    if (exerciseIndex < exercises.length - 1) {
      setExerciseIndex((prev) => prev + 1);
      return;
    }
    setSessionComplete(true);
  };

  const restart = () => {
    setExerciseIndex(0);
    setSelectedOption(null);
    setMatchAnswers({});
    setRevealedIds([]);
    setScore(0);
    setSessionComplete(false);
  };

  const playListenPrompt = () => {
    if (!currentExercise || currentExercise.type !== "listen_choose") return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentExercise.speechText);
    utterance.lang = getSpeechSynthesisLang(currentExercise.language);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const assignMatchMeaning = (meaning: string) => {
    if (!currentExercise || currentExercise.type !== "match_meaning" || !activeMatchWord || revealed) return;

    setMatchAnswers((prev) => {
      const next = { ...prev };
      for (const [word, assignedMeaning] of Object.entries(next)) {
        if (assignedMeaning === meaning) {
          delete next[word];
        }
      }
      next[activeMatchWord] = meaning;
      return next;
    });
    setActiveMatchWord(null);
  };

  const unassignMatchWord = (word: string) => {
    setMatchAnswers((prev) => {
      if (!prev[word]) return prev;
      const next = { ...prev };
      delete next[word];
      return next;
    });
    setActiveMatchWord((prev) => (prev === word ? null : prev));
  };

  const contextBlockClass =
    "mb-5 rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3";

  const contextTextClass =
    "text-xs leading-6 text-[var(--muted)]/75 sm:text-sm";

  const getCorrectAnswerText = (exercise: PracticeExercise | null) => {
    if (!exercise) return "";
    if (exercise.type === "match_meaning") {
      return exercise.pairs.map((pair) => `${pair.word} — ${pair.answer}`).join(" · ");
    }
    return exercise.answer;
  };

  const correctAnswerText = getCorrectAnswerText(currentExercise);
  const modeCards: Array<{
    mode: PracticeMode;
    title: string;
    detail: string;
    caption: string;
  }> = [
    {
      mode: "meaning",
      title: "Meaning",
      detail: "Choose the meaning that fits a word in context.",
      caption: "Best for locking in definitions with real usage.",
    },
    {
      mode: "context",
      title: "Context",
      detail: "Complete short sentences with the right word or expression.",
      caption: "Best for recall and sentence-level usage.",
    },
    {
      mode: "natural",
      title: "Natural usage",
      detail: "Spot the expression that sounds right in real language.",
      caption: "Best for phrases, connectors, and colloquial language.",
    },
    {
      mode: "listening",
      title: "Listening",
      detail: "Hear a word and choose what was said.",
      caption: "Best for audio recognition and fast review.",
    },
    {
      mode: "match",
      title: "Match",
      detail: "Match saved words to their meanings in quick sets.",
      caption: "Best for fast warm-up rounds.",
    },
  ];
  const completionTone = getCompletionTone(score, exercises.length);
  const completionBursts = useMemo(
    () => [
      { left: "8%", top: "18%", delay: "0ms", size: "h-2.5 w-2.5", color: "bg-emerald-300/80" },
      { left: "18%", top: "12%", delay: "80ms", size: "h-2 w-2", color: "bg-sky-300/80" },
      { left: "28%", top: "24%", delay: "160ms", size: "h-3 w-3", color: "bg-amber-200/85" },
      { left: "72%", top: "16%", delay: "120ms", size: "h-2.5 w-2.5", color: "bg-cyan-200/80" },
      { left: "82%", top: "10%", delay: "220ms", size: "h-2 w-2", color: "bg-emerald-200/80" },
      { left: "90%", top: "22%", delay: "140ms", size: "h-3 w-3", color: "bg-sky-200/80" },
      { left: "16%", top: "70%", delay: "260ms", size: "h-2 w-2", color: "bg-amber-200/75" },
      { left: "84%", top: "74%", delay: "320ms", size: "h-2.5 w-2.5", color: "bg-emerald-200/75" },
    ],
    []
  );

  if (!isLoaded || loadState === "loading") {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <div className="mb-4 h-9 w-48 animate-pulse rounded bg-[var(--card-bg)]" />
        <div className="mb-3 h-4 w-80 animate-pulse rounded bg-[var(--card-bg)]" />
        <div className="h-72 animate-pulse rounded-3xl bg-[var(--card-bg)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <h1 className="mb-2 text-3xl font-bold">Practice</h1>
        <p className="mb-5 text-sm text-[var(--muted)]">
          Sign in to practice your saved vocabulary with fill-in-the-blank, matching, listening,
          and context exercises.
        </p>
        <Link
          href="/sign-in?redirect_url=/practice"
          className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <h1 className="mb-2 text-3xl font-bold">Practice</h1>
        <p className="text-sm text-amber-300">Could not load your saved vocabulary right now.</p>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <h1 className="mb-2 text-3xl font-bold">Practice</h1>
        <p className="mb-5 text-sm text-[var(--muted)]">
          Save words while reading and they will appear here as exercises.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/explore"
            className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Explore stories
          </Link>
          <Link
            href="/favorites"
            className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
          >
            Open favorites
          </Link>
        </div>
      </div>
    );
  }

  if (activeSession) {
    return (
      <>
        <div className="min-h-screen px-4 py-3 pb-6 text-[var(--foreground)] sm:px-5 sm:py-4">
          <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={closeSession}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--bg-content)] text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
              aria-label="Close practice"
            >
              <X size={20} />
            </button>
            <div className="min-w-0 flex-1">
              {streak > 1 ? (
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-lime-300">
                  {streak} in a row
                </p>
              ) : null}
              <div className="h-3 overflow-hidden rounded-full bg-white/12">
                <div
                  className={`h-full rounded-full bg-[var(--primary)] transition-[width] duration-300 ${
                    lastResult === "correct" && revealed ? "animate-pulse" : ""
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  {modeCards.find((card) => card.mode === selectedMode)?.title ?? "Practice"}
                </p>
                <p className="shrink-0 text-xs text-[var(--muted)]">
                  {sessionComplete ? "Complete" : `${exerciseIndex + 1}/${exercises.length}`}
                </p>
              </div>
            </div>
          </div>

          {sessionComplete ? (
        <div
          className="relative overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-md"
          style={{ animation: "fade-in 220ms ease-out" }}
        >
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b ${completionTone.accent}`}
          />
          {completionBursts.map((burst, index) => (
            <span
              key={`burst-${index}`}
              aria-hidden="true"
              className={`pointer-events-none absolute rounded-full ${burst.size} ${burst.color}`}
              style={{
                left: burst.left,
                top: burst.top,
                animation: `completion-pop 900ms ease-out ${burst.delay} both`,
              }}
            />
          ))}

          <div className="relative">
            <div
              className={`mb-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/90 ${completionTone.pill}`}
              style={{ animation: "fade-in 260ms ease-out" }}
            >
              {completionTone.badge}
            </div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Session complete</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
              {completionTone.line}
            </p>

            <div className="mt-6 flex flex-wrap items-end gap-4 rounded-[1.75rem] border border-white/8 bg-white/[0.03] px-5 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Final score
                </p>
                <p
                  className={`mt-2 text-6xl font-bold leading-none sm:text-7xl ${completionTone.scoreColor}`}
                  style={{ animation: "score-pop 260ms ease-out" }}
                >
                  {score}/{exercises.length}
                </p>
              </div>
              <div className="pb-1 text-sm leading-6 text-[var(--muted)]">
                <p>You finished all {exercises.length} exercises in this set.</p>
                <p>{score === exercises.length ? "No misses this round." : `${exercises.length - score} to revisit next time.`}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={restart}
                className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Practice 10 more
              </button>
              <Link
                href="/favorites"
                className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
              >
                Open favorites
              </Link>
              <Link
                href="/"
                className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
              >
                Back to home
              </Link>
            </div>
          </div>

          <style jsx global>{`
            @keyframes completion-pop {
              0% {
                opacity: 0;
                transform: translateY(8px) scale(0.5);
              }
              60% {
                opacity: 1;
                transform: translateY(-6px) scale(1.08);
              }
              100% {
                opacity: 0;
                transform: translateY(-16px) scale(0.95);
              }
            }
            @keyframes score-pop {
              0% {
                opacity: 0;
                transform: translateY(12px) scale(0.96);
              }
              100% {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            @keyframes fade-in {
              0% {
                opacity: 0;
                transform: translateY(10px);
              }
              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </div>
      ) : currentExercise ? (
        <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-md sm:p-5">
          <p className="mb-4 text-base font-semibold sm:text-lg">{currentExercise.prompt}</p>

          {currentExercise.type === "fill_blank" ? (
            <>
              <div className={contextBlockClass}>
                <p className={contextTextClass}>{currentExercise.sentence}</p>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {currentExercise.options.map((option) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = revealed && option === currentExercise.answer;
                  const isWrong = revealed && isSelected && option !== currentExercise.answer;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedOption(option)}
                      disabled={revealed}
                      className={`rounded-2xl border px-4 py-2.5 text-left text-sm transition-colors ${
                        isCorrect
                          ? "border-emerald-400 bg-emerald-400 text-slate-950"
                          : isWrong
                            ? "border-rose-400 bg-rose-400 text-slate-950"
                            : isSelected
                              ? "border-blue-400 bg-blue-500/20"
                              : "border-[var(--card-border)] bg-[var(--bg-content)] hover:bg-[var(--card-bg-hover)]"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {currentExercise.type === "meaning_in_context" ? (
            <>
              <div className="mb-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  Target word
                </p>
                <p className="text-[2rem] font-semibold leading-none tracking-tight sm:text-[2.65rem]">
                  {currentExercise.word}
                </p>
              </div>
              <div className={contextBlockClass}>
                <p className={contextTextClass}>{currentExercise.sentence}</p>
              </div>
              <div className="grid gap-2.5">
                {currentExercise.options.map((option) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = revealed && option === currentExercise.answer;
                  const isWrong = revealed && isSelected && option !== currentExercise.answer;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedOption(option)}
                      disabled={revealed}
                      className={`rounded-2xl border px-4 py-2.5 text-left text-sm transition-colors ${
                        isCorrect
                          ? "border-emerald-400 bg-emerald-400 text-slate-950"
                          : isWrong
                            ? "border-rose-400 bg-rose-400 text-slate-950"
                            : isSelected
                              ? "border-blue-400 bg-blue-500/20"
                              : "border-[var(--card-border)] bg-[var(--bg-content)] hover:bg-[var(--card-bg-hover)]"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {currentExercise.type === "natural_expression" ? (
            <>
              <div className={contextBlockClass}>
                <p className={contextTextClass}>{currentExercise.sentence}</p>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {currentExercise.options.map((option) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = revealed && option === currentExercise.answer;
                  const isWrong = revealed && isSelected && option !== currentExercise.answer;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedOption(option)}
                      disabled={revealed}
                      className={`rounded-2xl border px-4 py-2.5 text-left text-sm transition-colors ${
                        isCorrect
                          ? "border-emerald-400 bg-emerald-400 text-slate-950"
                          : isWrong
                            ? "border-rose-400 bg-rose-400 text-slate-950"
                            : isSelected
                              ? "border-blue-400 bg-blue-500/20"
                              : "border-[var(--card-border)] bg-[var(--bg-content)] hover:bg-[var(--card-bg-hover)]"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {currentExercise.type === "listen_choose" ? (
            <>
              <button
                type="button"
                onClick={playListenPrompt}
                className="mb-4 inline-flex rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Play audio
              </button>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {currentExercise.options.map((option) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = revealed && option === currentExercise.answer;
                  const isWrong = revealed && isSelected && option !== currentExercise.answer;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedOption(option)}
                      disabled={revealed}
                      className={`rounded-2xl border px-4 py-2.5 text-left text-sm transition-colors ${
                        isCorrect
                          ? "border-emerald-400 bg-emerald-400 text-slate-950"
                          : isWrong
                            ? "border-rose-400 bg-rose-400 text-slate-950"
                            : isSelected
                              ? "border-blue-400 bg-blue-500/20"
                              : "border-[var(--card-border)] bg-[var(--bg-content)] hover:bg-[var(--card-bg-hover)]"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {currentExercise.type === "match_meaning" ? (
            <div className="space-y-3">
              <div>
                <div className="mb-2 grid grid-cols-2 gap-3">
                  <p className="px-1 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Words
                  </p>
                  <p className="px-1 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Meanings
                  </p>
                </div>
                <div className="space-y-2">
                  {currentExercise.pairs.map((pair, index) => {
                    const meaning = currentExercise.pairs[0]?.options[index];
                    const currentValue = matchAnswers[pair.word] ?? "";
                    const matchColor =
                      matchColorClasses[index % matchColorClasses.length];
                    const isActive = activeMatchWord === pair.word;
                    const isCorrect = revealed && currentValue === pair.answer;
                    const isWrong = revealed && currentValue && currentValue !== pair.answer;
                    const assignedWord =
                      meaning != null
                        ? Object.entries(matchAnswers).find(([, assignedMeaning]) => assignedMeaning === meaning)?.[0] ?? null
                        : null;
                    const isAssigned = Boolean(assignedWord);
                    const assignedIndex = assignedWord
                      ? currentExercise.pairs.findIndex((candidate) => candidate.word === assignedWord)
                      : -1;
                    const assignedPair =
                      assignedWord != null
                        ? currentExercise.pairs.find((candidate) => candidate.word === assignedWord) ?? null
                        : null;
                    const meaningColor =
                      assignedIndex >= 0
                        ? matchColorClasses[assignedIndex % matchColorClasses.length]
                        : "";
                    const meaningIsCorrect = revealed && assignedPair?.answer === meaning;
                    const meaningIsWrong = revealed && isAssigned && assignedPair?.answer !== meaning;

                    return (
                      <div key={`${pair.word}-${meaning ?? index}`} className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (revealed) return;
                            if (currentValue) {
                              unassignMatchWord(pair.word);
                              return;
                            }
                            setActiveMatchWord((prev) => (prev === pair.word ? null : pair.word));
                          }}
                          className={`flex min-h-[88px] w-full items-center justify-center rounded-xl border px-3 py-3 text-center transition ${
                            isCorrect
                              ? matchColor
                              : isWrong
                                ? "border-rose-400 bg-rose-400 text-slate-950"
                                : currentValue
                                  ? matchColor
                                  : isActive
                                    ? matchColor
                                    : "border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)]"
                          }`}
                        >
                          <div>
                            <p className="text-base font-semibold tracking-tight sm:text-lg">{pair.word}</p>
                            {revealed && currentValue !== pair.answer ? (
                              <div className="mt-2 rounded-lg border border-slate-950/12 bg-slate-950/8 px-2.5 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-900/65">
                                  Correct
                                </p>
                                <p className="mt-1 text-xs font-semibold leading-4 text-slate-950">
                                  {pair.answer}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </button>

                        {meaning ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (revealed) return;
                              if (assignedWord) {
                                unassignMatchWord(assignedWord);
                                return;
                              }
                              assignMatchMeaning(meaning);
                            }}
                            disabled={revealed || (!activeMatchWord && !assignedWord)}
                            className={`flex min-h-[88px] w-full items-center justify-center rounded-xl border px-3 py-3 text-center transition ${
                              meaningIsCorrect
                                ? meaningColor
                                : meaningIsWrong
                                  ? "border-rose-400 bg-rose-400 text-slate-950"
                                  : isAssigned
                                    ? meaningColor
                                    : "border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)]"
                            } disabled:opacity-100`}
                          >
                            <p className="text-xs leading-5 sm:text-sm sm:leading-6">{meaning}</p>
                          </button>
                        ) : (
                          <div />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {!revealed ? (
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={revealCurrent}
                disabled={
                  currentExercise.type === "match_meaning"
                    ? currentExercise.pairs.some((pair) => !matchAnswers[pair.word])
                    : !selectedOption
                }
                className="inline-flex min-w-[180px] justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                Check answer
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-md">
          <h2 className="text-2xl font-semibold tracking-tight">Not enough words yet</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            This mode needs a few more saved words with clear context before it can generate a useful session.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/favorites"
              className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Open favorites
            </Link>
            <button
              type="button"
              onClick={closeSession}
              className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
            >
              Choose another mode
            </button>
          </div>
        </div>
      )}

          {revealed && currentExercise ? (
            <div
              className={`sticky bottom-0 mt-4 rounded-3xl border px-4 py-4 shadow-xl ${
                lastResult === "correct"
                  ? "border-lime-300/30 bg-lime-300/14"
                  : "border-rose-300/30 bg-rose-300/14"
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p
                    className={`text-2xl font-bold tracking-tight sm:text-3xl ${
                      lastResult === "correct" ? "text-lime-300" : "text-rose-300"
                    }`}
                  >
                    {lastResult === "correct"
                      ? streak > 1
                        ? "Awesome!"
                        : "Good job!"
                      : currentExercise.type === "match_meaning"
                        ? "Check the corrected pairs above"
                        : "Correct answer:"}
                  </p>
                  {lastResult === "wrong" && currentExercise.type !== "match_meaning" ? (
                    <p className="mt-1.5 max-w-3xl text-sm leading-6 text-rose-50">
                      {correctAnswerText}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={goNext}
                  className={`inline-flex min-w-[150px] justify-center rounded-2xl px-4 py-2.5 text-sm font-extrabold uppercase tracking-[0.18em] ${
                    lastResult === "correct"
                      ? "bg-lime-400 text-slate-950 hover:bg-lime-300"
                      : "bg-rose-400 text-slate-950 hover:bg-rose-300"
                  }`}
                >
                  {exerciseIndex >= exercises.length - 1 ? "Finish" : "Continue"}
                </button>
              </div>
            </div>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">Practice</h1>
        <p className="text-sm text-[var(--muted)]">
          Choose how you want to practice, then focus on one short session at a time.
        </p>
      </div>
      <div className="mb-5 flex items-center gap-3 text-sm text-[var(--muted)]">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2">
          Due words {dueCount}
        </div>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2">
          Saved words {favorites.length}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modeCards.map((card) => (
          <button
            key={card.mode}
            type="button"
            onClick={() => openSession(card.mode)}
            className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 text-left shadow-md transition hover:bg-[var(--card-bg-hover)]"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              Practice mode
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">{card.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground)]/88">{card.detail}</p>
            <p className="mt-5 text-xs leading-5 text-[var(--muted)]">{card.caption}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
