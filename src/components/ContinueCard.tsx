"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import LevelBadge from "@/components/LevelBadge";
import LanguageBadge from "@/components/LanguageBadge";
import RegionBadge from "@/components/RegionBadge";

type Story = {
  href: string;
  coverUrl?: string;       // optional — falls back to gradient (NEVER empty)
  bookTitle: string;
  title: string;
  level?: string;
  language?: string;
  region?: string;
  timeLeft?: string;       // e.g. "3:09"
  topic?: string;
  progressPct?: number;    // 0..100
};

type Props = { story: Story };

/**
 * CONTINUE LISTENING card — used inside the home carousel.
 *
 * ⚠️ Card contract (do NOT change):
 *   - Cover image at the top (aspect 4/3). If `coverUrl` missing → render
 *     a navy gradient. NEVER render an empty/black box.
 *   - 3px gold progress bar overlays the bottom edge of the cover.
 *   - Play FAB appears on card hover, bottom-right of the cover.
 *   - Body: series (gold) → title (black, 2-line clamp) → badges → foot.
 */
export default function ContinueCard({ story }: Props) {
  const pct = Math.max(0, Math.min(100, story.progressPct ?? 0));

  return (
    <Link
      href={story.href}
      className="group flex flex-col rounded-2xl overflow-hidden bg-[var(--card-bg)] border border-[var(--card-border)] hover:bg-[var(--card-bg-hover)] hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* ── COVER (REQUIRED) ── */}
      <div className="dp-aspect-4-3 relative w-full bg-[var(--surface)] overflow-hidden">
        {story.coverUrl ? (
          <img
            src={story.coverUrl}
            alt={story.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #13315e 0%, #051834 100%)",
            }}
          />
        )}

        {/* Play FAB — hidden until card hover */}
        <span className="absolute right-3 bottom-3 w-10 h-10 rounded-full bg-[var(--color-gold)] text-[#2a1a02] grid place-items-center opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 shadow-[0_8px_22px_-6px_rgba(0,0,0,0.5)] z-10">
          <Play size={16} fill="currentColor" />
        </span>

        {/* Progress bar overlay */}
        <span className="absolute left-0 right-0 bottom-0 h-[4px] bg-black/45 z-10">
          <span
            className="block h-full bg-[var(--color-gold)]"
            style={{ width: `${pct}%` }}
          />
        </span>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-col gap-2 p-4 pt-3.5 flex-1">
        <div className="text-xs font-extrabold text-[var(--color-gold)] leading-tight line-clamp-1">
          {story.bookTitle}
        </div>
        <h3
          className="text-base font-black tracking-[-0.015em] leading-tight text-[var(--foreground)] line-clamp-2 min-h-[2.4em] m-0"
          style={{ textWrap: "balance" }}
        >
          {story.title}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <LevelBadge level={story.level} />
          <LanguageBadge language={story.language} />
          <RegionBadge region={story.region} />
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--muted)] mt-auto pt-1.5 tabular-nums">
          {story.timeLeft && <span>{story.timeLeft} left</span>}
          {story.timeLeft && story.topic && (
            <span className="w-[3px] h-[3px] rounded-full bg-[var(--muted)]" />
          )}
          {story.topic && <span className="line-clamp-1">{story.topic}</span>}
        </div>
      </div>
    </Link>
  );
}
