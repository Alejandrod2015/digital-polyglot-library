"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Flame } from "lucide-react";

const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];
const STORAGE_KEY = "dpl:streak-last-shown";

/**
 * Toast that appears when the user crosses a streak milestone. Fetches
 * /api/progress once on mount (authenticated users only), compares against
 * localStorage to avoid showing the same milestone twice, then auto-dismisses
 * after 5s.
 */
export function StreakCelebration() {
  const { isSignedIn } = useAuth();
  const [streak, setStreak] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/progress");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const current = typeof data?.practiceStreakDays === "number" ? data.practiceStreakDays : 0;
        if (current <= 0) return;
        const milestone = MILESTONES.includes(current) ? current : null;
        if (milestone === null) return;
        const lastShown = Number(localStorage.getItem(STORAGE_KEY) || 0);
        if (lastShown >= milestone) return;
        setStreak(milestone);
        setVisible(true);
        localStorage.setItem(STORAGE_KEY, String(milestone));
        const timer = window.setTimeout(() => setVisible(false), 5000);
        return () => window.clearTimeout(timer);
      } catch {
        // non-blocking
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  if (!visible || streak === null) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-amber-300/30 bg-[rgba(31,22,8,0.96)] px-4 py-3 shadow-[0_18px_50px_rgba(252,211,77,0.22)] backdrop-blur"
      style={{ animation: "streak-pop 320ms cubic-bezier(0.34,1.56,0.64,1) both" }}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-300/15">
          <Flame size={22} className="text-amber-300" />
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/80">
            Streak milestone
          </p>
          <p className="text-base font-extrabold text-amber-50">
            {streak} days in a row
          </p>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-amber-100/60 hover:text-amber-100"
        >
          ×
        </button>
      </div>
      <style jsx>{`
        @keyframes streak-pop {
          0% { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.9); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
