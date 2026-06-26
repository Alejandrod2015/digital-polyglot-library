"use client";

type Props = {
  /** Current streak length in days. 0 is a valid state. */
  days: number;
  /** Last-7-days boolean array. Length 7. Today is last. */
  weekDots?: boolean[];
};

/**
 * Streak card shown in the Sidebar, above the profile pill.
 *
 * Data source: `GamificationSummary` from src/lib/gamification.
 * If `weekDots` isn't available yet, omit it; the dots will render as empty.
 */
export default function StreakCard({ days, weekDots }: Props) {
  const dots =
    (weekDots ?? Array.from({ length: 7 }, () => false)).slice(0, 7);

  return (
    <div className="p-3.5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)]">
      <div className="text-[11px] font-extrabold tracking-[0.14em] uppercase text-[var(--muted)] mb-2.5">
        Current streak
      </div>

      <div className="flex items-baseline gap-2 text-[30px] font-black text-[var(--foreground)] tracking-[-0.025em] leading-none">
        <span className="text-2xl leading-none">🔥</span>
        {days}
        <span className="text-sm font-bold text-[var(--muted)] tracking-normal">
          days
        </span>
      </div>

      <div className="text-[12.5px] font-bold text-[var(--muted)] mt-1">
        {days === 0
          ? "Start today to begin a streak"
          : "Keep it going; listen today"}
      </div>

      <div className="flex gap-1 mt-2.5">
        {dots.map((on, i) => (
          <span
            key={i}
            className={`flex-1 h-1 rounded-sm ${
              on ? "bg-[#fb923c]" : "bg-[var(--card-border)]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
