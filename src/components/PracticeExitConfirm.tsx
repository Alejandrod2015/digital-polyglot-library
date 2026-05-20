"use client";

import { useEffect } from "react";

export function PracticeExitConfirm({
  onKeepGoing,
  onExit,
}: {
  onKeepGoing: () => void;
  onExit: () => void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onKeepGoing();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKey);
    };
  }, [onKeepGoing]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="practice-exit-title"
      data-testid="qa-practice-exit-confirm"
    >
      <button
        type="button"
        aria-label="Keep practicing"
        onClick={onKeepGoing}
        className="absolute inset-0 bg-[rgba(6,12,24,0.72)]"
        style={{ animation: "fade-in 180ms ease-out both" }}
      />
      <div
        className="relative w-full max-w-[360px] rounded-[1.4rem] border border-white/10 bg-[#132033] px-6 pb-4 pt-6 shadow-2xl"
        style={{ animation: "exit-confirm-pop 320ms cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        <h2
          id="practice-exit-title"
          className="text-[20px] font-extrabold tracking-tight text-[#f5f7fb]"
        >
          Exit without finishing?
        </h2>
        <p className="mt-3 text-sm leading-5 text-[#aebcd3]">
          Your streak and score for this round won&rsquo;t be saved.
        </p>
        <button
          type="button"
          onClick={onKeepGoing}
          className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-amber-300 px-4 py-3.5 text-sm font-extrabold tracking-wide text-slate-950 hover:brightness-105"
        >
          Keep practicing
        </button>
        <button
          type="button"
          onClick={onExit}
          className="mt-2 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-[#8fa3c2] hover:text-white"
        >
          Exit anyway
        </button>
      </div>
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes exit-confirm-pop {
          0% { opacity: 0; transform: translateY(40px) scale(0.92); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
