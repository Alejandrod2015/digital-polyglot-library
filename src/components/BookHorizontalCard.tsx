"use client";

import Link from "next/link";
import Cover from "@/components/Cover";
import type { ReactNode } from "react";
import LevelBadge from "@/components/LevelBadge";
import LanguageBadge from "@/components/LanguageBadge";
import RegionBadge from "@/components/RegionBadge";
import VariantBadge from "@/components/VariantBadge";

function stripHtml(input?: string): string {
  return (input ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function excerpt(text?: string, max = 160): string {
  const clean = stripHtml(text);
  if (!clean) return "";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}...`;
}

export type BookStat = {
  /** Big bold number (e.g. "20", "~65 min", "7/20"). */
  value: string | number;
  /** Lowercase suffix label (e.g. "stories", "min", "done"). */
  label?: string;
};

type BookHorizontalCardProps = {
  title: string;
  cover?: string;
  language?: string;
  variant?: string;
  region?: string;
  /** Inline stats row "20 stories · ~65 min · 7/20 done". */
  stats?: BookStat[];
  /** Legacy single-line stats string. Rendered when `stats` is empty. */
  statsLine?: string;
  topicsLine?: string;
  level?: string;
  description?: string;
  href: string;
  footer?: ReactNode;
};

/**
 * Card spec from handoff v2 §6:
 *   - padding 20px
 *   - grid 122px 1fr, gap 20px, align-items center, min-height 222px
 *   - cover: aspect 2/3, radius 10px, heavy box-shadow
 *   - title 18px / 900 / -0.015em
 *   - stats inline "20 stories · ~65 min · 7/20 done" — strongs are foreground 900,
 *     labels are muted
 *   - footer slot for "Start book" + "+ Library" CTAs (rendered by caller)
 */
export default function BookHorizontalCard({
  title,
  cover,
  language,
  variant,
  region,
  stats,
  statsLine,
  topicsLine,
  level,
  description,
  href,
  footer,
}: BookHorizontalCardProps) {
  return (
    <div className="flex min-h-[222px] items-center gap-5 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 transition-all duration-150 hover:-translate-y-0.5 hover:bg-[var(--card-bg-hover)]">
      <Link
        href={href}
        aria-label={title}
        className="block w-[122px] shrink-0 shadow-[0_14px_28px_-10px_rgba(0,0,0,0.55),0_4px_10px_-4px_rgba(0,0,0,0.4)]"
      >
        <Cover src={cover ?? "/covers/default.jpg"} alt={title} className="w-[122px]" />
      </Link>

      <div className="flex min-w-0 flex-col gap-2 text-[var(--foreground)]">
        <div className="flex flex-wrap items-center gap-1.5">
          <LevelBadge level={level} />
          <LanguageBadge language={language} />
          <VariantBadge variant={variant} />
          <RegionBadge region={region} />
        </div>
        <Link
          href={href}
          className="text-[18px] font-black leading-[1.2] tracking-[-0.015em] text-[var(--foreground)] line-clamp-2 hover:underline"
          style={{ textWrap: "balance" }}
        >
          {title}
        </Link>
        {stats && stats.length > 0 ? (
          <div className="flex flex-wrap gap-4 tabular-nums text-[12.5px] font-bold text-[var(--muted)]">
            {stats.map((stat, index) => (
              <span key={index} className="inline-flex items-baseline gap-1 whitespace-nowrap">
                <strong className="font-black text-[var(--foreground)]">{stat.value}</strong>
                {stat.label ? <span>{stat.label}</span> : null}
              </span>
            ))}
          </div>
        ) : statsLine ? (
          <p className="text-xs text-[var(--muted)]">{statsLine}</p>
        ) : null}
        {topicsLine ? (
          <p className="line-clamp-1 text-[12.5px] font-bold text-[var(--muted)]">{topicsLine}</p>
        ) : null}
        {description ? (
          <p className="line-clamp-2 text-[13.5px] font-semibold leading-[1.5] text-[var(--muted)]">
            {excerpt(description, 160)}
          </p>
        ) : null}
        {footer ? <div className="mt-1 flex items-center gap-2.5">{footer}</div> : null}
      </div>
    </div>
  );
}
