"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Clock, X, Zap } from "lucide-react";

type Props = {
  storySlug: string;
  storyTitle?: string;
  vocabCount: number;
  /** Full practice URL. When provided, used as-is (e.g. journey context
   *  passes a pre-built `/practice?source=journey&...` URL). When
   *  absent, the component builds the standard story-practice URL. */
  practiceHref?: string;
};

/** Look up the active <audio> element on the page. Player.tsx renders
 *  a single bottom-docked audio element. */
function findStoryAudio(): HTMLAudioElement | null {
  return document.querySelector("audio");
}

/**
 * iPhone-parity "Lock it in" end-of-story practice prompt.
 *
 * TRIGGER: the prompt opens ONLY when the story's narration audio
 * finishes playing (HTMLAudioElement `ended` event). This matches the
 * iPhone reader where `playback.didJustFinish` is the single source of
 * truth — scroll-based triggers were removed there to avoid double-firing
 * when the user scrubs back and forth. If the story has no audio, the
 * prompt simply never appears (the user navigates manually).
 *
 * Mobile reference: `maybeFireEndOfStoryPrompt` + `playback.didJustFinish`
 * in ReaderScreen.tsx.
 *
 * Only fires once per page lifetime. Dismissal is sticky (no nag).
 */
export default function EndOfStoryPracticePrompt({
  storySlug,
  storyTitle,
  vocabCount,
  practiceHref,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const firedRef = useRef(false);

  // Attach an `ended` listener to the story's <audio>. We retry the
  // lookup because the Player component mounts after this component
  // (audio src loaded async). Skip entirely when there's no vocab —
  // nothing to practice. Mirrors `if (vocab.length === 0) return;`
  // in ReaderScreen.tsx.
  useEffect(() => {
    if (dismissed || vocabCount === 0) return;

    let cleanup: (() => void) | undefined;
    let attempts = 0;
    const maxAttempts = 40; // 40 * 250ms = 10 s window

    function attach() {
      const audio = findStoryAudio();
      if (!audio) {
        if (attempts++ < maxAttempts) {
          const t = window.setTimeout(attach, 250);
          cleanup = () => window.clearTimeout(t);
        }
        return;
      }

      function onEnded() {
        if (firedRef.current) return;
        firedRef.current = true;
        setVisible(true);
      }

      audio.addEventListener("ended", onEnded);
      cleanup = () => audio.removeEventListener("ended", onEnded);
    }

    attach();
    return () => cleanup?.();
  }, [dismissed, vocabCount]);

  // Lock body scroll while visible to keep the dialog focused.
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  // Esc closes
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  function close() {
    setVisible(false);
    setDismissed(true);
  }

  // Default to the story-practice URL the /practice page actually
  // understands (see src/app/practice/page.tsx — searchParams `source`,
  // `storySlug`, `storyTitle`, `storyHref`).
  const defaultHref = (() => {
    const params = new URLSearchParams();
    params.set("source", "story");
    params.set("storySlug", storySlug);
    if (storyTitle) params.set("storyTitle", storyTitle);
    params.set("storyHref", `/stories/${storySlug}`);
    return `/practice?${params.toString()}`;
  })();
  const href = practiceHref ?? defaultHref;
  const wordsLabel =
    vocabCount > 0
      ? `Practice ${vocabCount} word${vocabCount === 1 ? "" : "s"}`
      : "Practice what you just learned";

  return (
    <>
      {visible && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-of-story-title"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-sm"
          />

          {/* Card */}
          <div
            className="relative z-10 mx-3 w-full max-w-md rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] px-6 pb-6 pt-7 text-center shadow-[0_24px_64px_-12px_rgba(0,0,0,0.6)]"
            style={{
              animation: "dp-eos-pop 280ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 inline-grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] transition hover:bg-white/[0.06] hover:text-[var(--foreground)]"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Trophy / zap badge */}
            <div className="mx-auto mb-3 inline-grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[#fde68a] to-[#f59e0b] shadow-[0_8px_24px_-8px_rgba(245,158,11,0.55)]">
              <Zap className="h-7 w-7 text-[#0e1727]" strokeWidth={2.6} />
            </div>

            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-gold)]">
              Lock it in
            </div>
            <h2
              id="end-of-story-title"
              className="mt-1.5 text-[22px] font-black leading-tight tracking-[-0.015em] text-[var(--foreground)]"
            >
              {wordsLabel}
            </h2>
            <p className="mt-2 text-[13.5px] leading-snug text-[var(--muted)]">
              You remember 2× more when you practice right after reading.
            </p>

            {vocabCount > 0 ? (
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--bg-1)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--foreground)]">
                  <BookOpen className="h-3 w-3 text-[var(--color-gold)]" />
                  {vocabCount} new word{vocabCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--bg-1)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--foreground)]">
                  <Clock className="h-3 w-3 text-emerald-300" />
                  ~1 min
                </span>
              </div>
            ) : null}

            <Link
              href={href}
              onClick={() => setVisible(false)}
              className="dp-eos-cta mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-gold)] px-4 py-3 text-[15px] font-extrabold text-[#0e1727] shadow-[0_8px_24px_-8px_rgba(248,193,92,0.55)] transition hover:brightness-105 active:translate-y-[2px]"
            >
              <Zap className="h-4 w-4" strokeWidth={2.6} />
              Start practice
            </Link>

            <button
              type="button"
              onClick={close}
              className="mt-3 w-full text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </>
  );
}
