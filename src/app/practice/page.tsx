"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  buildPracticeSession,
  getDuePracticeItems,
  getSpeechSynthesisLang,
  PracticeFavoriteItem,
  PracticeSourceMode,
} from "@/lib/practiceExercises";

type LoadState = "loading" | "ready" | "error";

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
  const [sourceMode, setSourceMode] = useState<PracticeSourceMode>("due");
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [matchAnswers, setMatchAnswers] = useState<Record<string, string>>({});
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);

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

  const exercises = useMemo(() => buildPracticeSession(favorites, sourceMode), [favorites, sourceMode]);
  const currentExercise = exercises[exerciseIndex] ?? null;
  const dueCount = useMemo(() => getDuePracticeItems(favorites).length, [favorites]);
  const revealed = currentExercise ? revealedIds.includes(currentExercise.id) : false;

  useEffect(() => {
    setExerciseIndex(0);
    setSelectedOption(null);
    setMatchAnswers({});
    setRevealedIds([]);
    setScore(0);
    setSessionComplete(false);
  }, [sourceMode, favorites.length]);

  useEffect(() => {
    setSelectedOption(null);
    setMatchAnswers({});
  }, [exerciseIndex]);

  const revealCurrent = () => {
    if (!currentExercise) return;
    setRevealedIds((prev) => (prev.includes(currentExercise.id) ? prev : [...prev, currentExercise.id]));

    const isCorrect =
      currentExercise.type === "match_meaning"
        ? currentExercise.pairs.every((pair) => matchAnswers[pair.word] === pair.answer)
        : selectedOption === currentExercise.answer;

    if (isCorrect) {
      setScore((prev) => prev + 1);
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

  const sourceButtonClass = (mode: PracticeSourceMode) =>
    `rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
      sourceMode === mode
        ? "bg-blue-600 text-white"
        : "bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
    }`;

  const contextBlockClass =
    "mb-5 rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3";

  const contextTextClass =
    "text-xs leading-6 text-[var(--muted)]/75 sm:text-sm";
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

  if (exercises.length === 0) {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <h1 className="mb-2 text-3xl font-bold">Practice</h1>
        <p className="mb-5 text-sm text-[var(--muted)]">
          You need a few more saved words with context before these exercises can be generated.
        </p>
        <Link
          href="/favorites"
          className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Review favorites
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">Practice</h1>
        <p className="text-sm text-[var(--muted)]">
          Work through vocabulary with context, natural usage, listening, and matching.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setSourceMode("due")} className={sourceButtonClass("due")}>
          Due words ({dueCount})
        </button>
        <button type="button" onClick={() => setSourceMode("all")} className={sourceButtonClass("all")}>
          Saved words ({favorites.length})
        </button>
        <div className="ml-auto rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--muted)]">
          Score {score}/{revealedIds.length}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-sm text-[var(--muted)]">
        <span>
          Exercise {exerciseIndex + 1}/{exercises.length}
        </span>
        <span className="capitalize">{currentExercise?.type.replaceAll("_", " ")}</span>
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
        <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-md">
          <p className="mb-5 text-lg font-semibold">{currentExercise.prompt}</p>

          {currentExercise.type === "fill_blank" ? (
            <>
              <div className={contextBlockClass}>
                <p className={contextTextClass}>{currentExercise.sentence}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
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
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
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
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  Target word
                </p>
                <p className="text-[2.3rem] font-semibold leading-none tracking-tight sm:text-[3rem]">
                  {currentExercise.word}
                </p>
              </div>
              <div className={contextBlockClass}>
                <p className={contextTextClass}>{currentExercise.sentence}</p>
              </div>
              <div className="grid gap-3">
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
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
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
              <div className="grid gap-3 sm:grid-cols-2">
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
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
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
                className="mb-5 inline-flex rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Play audio
              </button>
              <div className="grid gap-3 sm:grid-cols-2">
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
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
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
              {currentExercise.pairs.map((pair) => {
                const currentValue = matchAnswers[pair.word] ?? "";
                const isCorrect = revealed && currentValue === pair.answer;
                const isWrong = revealed && currentValue && currentValue !== pair.answer;
                return (
                  <div key={pair.word} className="rounded-2xl border border-[var(--card-border)] bg-[var(--bg-content)] p-4">
                    <p className="mb-2 text-lg font-semibold tracking-tight">{pair.word}</p>
                    <select
                      value={currentValue}
                      onChange={(event) =>
                        setMatchAnswers((prev) => ({ ...prev, [pair.word]: event.target.value }))
                      }
                      disabled={revealed}
                      className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${
                        isCorrect
                          ? "border-emerald-400 bg-emerald-400 text-slate-950"
                          : isWrong
                            ? "border-rose-400 bg-rose-400 text-slate-950"
                            : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)]"
                      }`}
                    >
                      <option value="">Choose meaning</option>
                      {pair.options.map((option) => (
                        <option key={`${pair.word}:${option}`} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {revealed && currentValue !== pair.answer ? (
                      <p className="mt-2 text-xs text-emerald-300">Correct: {pair.answer}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!revealed ? (
              <button
                type="button"
                onClick={revealCurrent}
                disabled={
                  currentExercise.type === "match_meaning"
                    ? currentExercise.pairs.some((pair) => !matchAnswers[pair.word])
                    : !selectedOption
                }
                className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                Check answer
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={exerciseIndex >= exercises.length - 1}
                className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                Next
              </button>
            )}

            <button
              type="button"
              onClick={restart}
              className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
            >
              Restart session
            </button>

            <Link
              href="/favorites"
              className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
            >
              Open favorites
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
