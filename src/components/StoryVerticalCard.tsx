"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import LevelBadge from "@/components/LevelBadge";
import LanguageBadge from "@/components/LanguageBadge";
import RegionBadge from "@/components/RegionBadge";
import VariantBadge from "@/components/VariantBadge";

type StoryVerticalCardProps = {
  href: string;
  title: string;
  coverUrl?: string;
  subtitle?: string;
  excerpt?: string;
  meta?: string;
  metaSecondary?: string;
  /** Topic line shown at the bottom (12.5/700/muted). */
  topic?: string;
  level?: string;
  language?: string;
  variant?: string;
  region?: string;
  className?: string;
  footer?: ReactNode;
};

/**
 * Card spec from handoff v2 §7:
 *   - image area aspect-ratio 4/3 (not the legacy h-48)
 *   - body padding 18px 18px 20px, gap 10px
 *   - subtitle: 12.5px / 800 / gold (--color-gold)
 *   - title: 17px / 900 / -0.015em
 *   - topic footer line at the bottom: 12.5px / 700 / muted
 */
export default function StoryVerticalCard({
  href,
  title,
  coverUrl,
  subtitle,
  excerpt,
  meta,
  metaSecondary,
  topic,
  level,
  language,
  variant,
  region,
  className = "",
  footer,
}: StoryVerticalCardProps) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[var(--card-bg-hover)] ${className}`}
    >
      <Link href={href} className="flex flex-1 flex-col">
        <div className="dp-aspect-4-3 relative w-full overflow-hidden bg-[var(--surface)]">
          <img
            src={coverUrl || "/covers/default.jpg"}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        <div className="flex flex-1 flex-col gap-2.5 px-[18px] pb-5 pt-[18px] text-left">
          {subtitle ? (
            <p className="m-0 text-[12.5px] font-extrabold text-[var(--color-gold)]">
              {subtitle}
            </p>
          ) : null}
          <h3
            className="m-0 line-clamp-2 text-[17px] font-black leading-[1.2] tracking-[-0.015em] text-[var(--foreground)]"
            style={{ textWrap: "balance" }}
          >
            {title}
          </h3>
          {excerpt ? (
            <p className="line-clamp-3 text-[13.5px] font-semibold leading-[1.5] text-[var(--muted)]">
              {excerpt}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <LevelBadge level={level} />
            <LanguageBadge language={language} />
            <VariantBadge variant={variant} />
            <RegionBadge region={region} />
          </div>
          {(meta || metaSecondary) ? (
            <div className="space-y-1 text-sm text-[var(--muted)]">
              {meta ? <p>{meta}</p> : null}
              {metaSecondary ? <p>{metaSecondary}</p> : null}
            </div>
          ) : null}
          {topic ? (
            <p className="mt-auto pt-1 text-[12.5px] font-bold text-[var(--muted)]">{topic}</p>
          ) : null}
        </div>
      </Link>

      {footer ? <div className="border-t border-[var(--card-border)] px-3 py-2">{footer}</div> : null}
    </div>
  );
}
