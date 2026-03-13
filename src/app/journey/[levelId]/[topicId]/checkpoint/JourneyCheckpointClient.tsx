"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, CircleDashed, Play, Sparkles, Square, XCircle } from "lucide-react";
import type { JourneyCheckpointQuestion } from "@/app/journey/journeyData";

const PASS_THRESHOLD = 0.8;

type CheckpointClientProps = {
  levelId: string;
  topicSlug: string;
  topicLabel: string;
  variantId?: string;
  alreadyPassed: boolean;
  questions: JourneyCheckpointQuestion[];
};

export default function CheckpointClient({
  levelId,
  topicSlug,
  topicLabel,
  variantId,
  alreadyPassed,
  questions,
}: CheckpointClientProps) {
  const [selectedById, setSelectedById] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [activeTtsId, setActiveTtsId] = useState<string | null>(null);
  const [voicesReady, setVoicesReady] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; passed: boolean } | null>(
    alreadyPassed ? { score: questions.length, total: questions.length, passed: true } : null
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const synth = window.speechSynthesis;
    const handleVoicesChanged = () => setVoicesReady(true);
    handleVoicesChanged();
    synth.addEventListener("voiceschanged", handleVoicesChanged);

    return () => {
      synth.cancel();
      synth.removeEventListener("voiceschanged", handleVoicesChanged);
    };
  }, []);

  const answeredCount = useMemo(
    () => Object.keys(selectedById).filter((key) => selectedById[key]).length,
    [selectedById]
  );

  const submitDisabled = submitting || answeredCount < questions.length || Boolean(result?.passed);
  const questionTitleByKind: Record<JourneyCheckpointQuestion["kind"], string> = {
    meaning: "",
    context: "Fill the gap",
    listening: "Listen closely",
    natural_usage: "Natural usage",
  };

  function resolveVoice(): SpeechSynthesisVoice | null {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const ranked = voices
      .map((voice) => {
        const name = voice.name.toLowerCase();
        let score = 0;
        if (voice.lang.toLowerCase().startsWith("es")) score += 60;
        if (name.includes("google")) score += 35;
        if (name.includes("microsoft")) score += 28;
        if (name.includes("natural") || name.includes("neural") || name.includes("enhanced")) score += 18;
        if (voice.default) score += 8;
        return { voice, score };
      })
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.voice ?? null;
  }

  function playTts(question: JourneyCheckpointQuestion) {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !question.ttsText) return;
    const synth = window.speechSynthesis;

    if (activeTtsId === question.id) {
      synth.cancel();
      setActiveTtsId(null);
      return;
    }

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(question.ttsText);
    const voice = resolveVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "es-ES";
    }
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onend = () => setActiveTtsId(null);
    utterance.onerror = () => setActiveTtsId(null);
    setActiveTtsId(question.id);
    synth.speak(utterance);
  }

  async function handleSubmit() {
    if (submitDisabled) return;

    const score = questions.reduce((total, question) => {
      return total + (selectedById[question.id] === question.answer ? 1 : 0);
    }, 0);
    const total = questions.length;
    const passed = score / total >= PASS_THRESHOLD;
    setResult({ score, total, passed });

    if (!passed) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/journey/checkpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId,
          levelId,
          topicSlug,
          score,
          total,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save checkpoint");
      }
    } catch {
      setResult({ score, total, passed: false });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-14 pt-4 sm:px-6 lg:px-8">
      <section className="rounded-[1.35rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.08),transparent_18%),linear-gradient(180deg,#0a2b56_0%,#08264d_56%,#071f43_100%)] px-4 py-3 sm:rounded-[1.75rem] sm:px-5 sm:py-4">
        <Link
          href={variantId ? `/journey/${levelId}/${topicSlug}?variant=${encodeURIComponent(variantId)}` : `/journey/${levelId}/${topicSlug}`}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/88 hover:bg-white/10"
        >
          <ChevronLeft size={16} />
          Back to journey
        </Link>

        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100/75">
            {levelId.toUpperCase()} checkpoint
          </p>
          <h1 className="mt-1 text-[1.65rem] font-black leading-none tracking-tight text-white sm:text-[2.4rem]">
            {topicLabel}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300/82 sm:text-base">
            Clear this checkpoint to unlock the next topic.
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,45,82,0.96),rgba(11,31,61,0.98))] px-4 py-4 shadow-[0_20px_50px_rgba(2,10,26,0.28)] sm:px-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200/85">
            <Sparkles size={14} />
            {questions.length} questions
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200/85">
            <CircleDashed size={14} />
            {answeredCount}/{questions.length} answered
          </div>
        </div>

        <div className="space-y-3">
          {questions.map((question, index) => {
            const selected = selectedById[question.id];
            const showResult = Boolean(result);
            return (
              <div
                key={question.id}
                className="rounded-[1.4rem] border border-white/10 bg-[#10284a] px-4 py-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300/75">
                    {question.kind.replace("_", " ")} · Question {index + 1}
                  </p>
                  {showResult && selected === question.answer ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-200">
                      <CheckCircle2 size={14} />
                      Correct
                    </span>
                  ) : null}
                  {showResult && selected && selected !== question.answer ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-200">
                      <XCircle size={14} />
                      Missed
                    </span>
                  ) : null}
                </div>

                <h2 className="text-lg font-black tracking-tight text-white">
                  {question.kind === "meaning" ? question.word : questionTitleByKind[question.kind]}
                </h2>
                <p className="mt-1 text-sm text-slate-300/82">{question.prompt}</p>
                {question.stem ? (
                  <p className="mt-2 rounded-[1rem] border border-white/8 bg-[#0b2342] px-3 py-3 text-sm text-slate-100/92">
                    {question.stem}
                  </p>
                ) : null}
                {question.kind === "listening" ? (
                  <button
                    type="button"
                    onClick={() => playTts(question)}
                    disabled={!voicesReady && typeof window !== "undefined" && window.speechSynthesis.getVoices().length === 0}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black uppercase tracking-[0.14em] text-white/88 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {activeTtsId === question.id ? <Square size={14} /> : <Play size={14} />}
                    {activeTtsId === question.id ? "Stop" : "Play"}
                  </button>
                ) : null}

                <div className="mt-3 grid gap-2">
                  {question.options.map((option) => {
                    const isSelected = selected === option;
                    const isAnswer = question.answer === option;
                    const resultState = showResult
                      ? isAnswer
                        ? "border-emerald-300/30 bg-emerald-400/10 text-white"
                        : isSelected
                          ? "border-rose-300/30 bg-rose-400/10 text-white"
                          : "border-white/8 bg-[#0b2342] text-slate-200/92"
                      : isSelected
                        ? "border-sky-300/30 bg-sky-400/10 text-white"
                        : "border-white/8 bg-[#0b2342] text-slate-200/92 hover:bg-white/[0.06]";

                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={showResult}
                        onClick={() =>
                          setSelectedById((current) => ({
                            ...current,
                            [question.id]: option,
                          }))
                        }
                        className={`w-full rounded-[1rem] border px-4 py-3 text-left text-sm font-semibold transition ${resultState}`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-[#0e2341] px-4 py-4">
          {result ? (
            <div className="space-y-3 text-center">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300/75">
                  Result
                </p>
                <h3 className="mt-1 text-3xl font-black tracking-tight text-white">
                  {result.score}/{result.total}
                </h3>
                <p className={`mt-2 text-sm font-semibold ${result.passed ? "text-emerald-200" : "text-amber-200"}`}>
                  {result.passed ? "Checkpoint cleared. The next topic is now open." : "You need 80% to pass. Review and try again."}
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href={variantId ? `/journey/${levelId}/${topicSlug}?variant=${encodeURIComponent(variantId)}` : `/journey/${levelId}/${topicSlug}`}
                  className="inline-flex min-w-[180px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white hover:bg-white/10"
                >
                  Back to topic
                </Link>
                {!result.passed ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedById({});
                      setResult(null);
                    }}
                    className="inline-flex min-w-[180px] items-center justify-center rounded-full border border-sky-200/20 bg-sky-400/10 px-5 py-3 text-sm font-black text-sky-100 hover:bg-sky-400/15"
                  >
                    Retry checkpoint
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300/75">
                  Pass mark
                </p>
                <p className="mt-1 text-sm text-slate-200/88">Score at least 80% to unlock the next topic.</p>
              </div>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitDisabled}
                className={`inline-flex min-w-[180px] items-center justify-center rounded-full px-5 py-3 text-sm font-black transition ${
                  submitDisabled
                    ? "cursor-not-allowed border border-white/8 bg-white/[0.05] text-white/40"
                    : "border border-lime-200/25 bg-lime-300 text-slate-950 shadow-[0_10px_24px_rgba(163,230,53,0.22)] hover:brightness-105"
                }`}
              >
                {submitting ? "Saving..." : "Finish checkpoint"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
