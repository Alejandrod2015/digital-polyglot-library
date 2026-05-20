"use client";

import { useEffect, useRef, useState } from "react";

const STEP_MS = 700;
const LABELS = ["3", "2", "1", "GO"] as const;

export function PracticeCountdown({
  accent = "#fcd34d",
  onComplete,
}: {
  accent?: string;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (step < LABELS.length - 1) {
        setStep((s) => s + 1);
      } else {
        onCompleteRef.current();
      }
    }, STEP_MS);
    return () => window.clearTimeout(id);
  }, [step]);

  const isGo = step === LABELS.length - 1;
  const color = isGo ? "#86efac" : accent;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(6,12,24,0.86)]"
      role="status"
      aria-live="polite"
      data-testid="qa-practice-countdown"
    >
      <span
        key={step}
        className="select-none tabular-nums font-black tracking-tight"
        style={{
          fontSize: isGo ? "clamp(5rem,18vw,11rem)" : "clamp(6rem,22vw,14rem)",
          color,
          textShadow: `0 12px 60px ${color}80`,
          animation: "countdown-pop 700ms cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {LABELS[step]}
      </span>
      <style jsx>{`
        @keyframes countdown-pop {
          0% { opacity: 0; transform: scale(0.4); }
          30% { opacity: 1; transform: scale(1.08); }
          75% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.95); }
        }
      `}</style>
    </div>
  );
}
