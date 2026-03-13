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

function excerpt(text?: string, max = 132): string {
  const clean = stripHtml(text);
  if (!clean) return "";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}...`;
}

type BookHorizontalCardProps = {
  title: string;
  cover?: string;
  language?: string;
  variant?: string;
  region?: string;
  meta?: string;
  statsLine?: string;
  topicsLine?: string;
  level?: string;
  description?: string;
  href: string;
  footer?: ReactNode;
};

export default function BookHorizontalCard({
  title,
  cover,
  language,
  variant,
  region,
  meta,
  statsLine,
  topicsLine,
  level,
  description,
  href,
  footer,
}: BookHorizontalCardProps) {
  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] hover:shadow-md transition-all duration-200">
      <Link
        href={href}
        className="flex items-start gap-2.5 w-full p-4 h-full min-h-[168px] sm:min-h-[196px] md:items-center md:gap-5 md:p-5 md:min-h-[230px]"
      >
        <div className="w-[84px] sm:w-[106px] md:w-[34%] md:max-w-[122px] flex-shrink-0">
          <Cover src={cover ?? "/covers/default.jpg"} alt={title} />
        </div>

        <div className="flex flex-col justify-start text-left flex-1 text-[var(--foreground)] min-w-0">
          <div className="mb-1 md:mb-2 flex flex-wrap items-center gap-2">
            <LevelBadge level={level} />
            <LanguageBadge language={language} />
            <VariantBadge variant={variant} />
            <RegionBadge region={region} />
          </div>
          <p className="font-semibold text-[1.05rem] leading-tight mb-1.5 md:mb-2 line-clamp-3 md:line-clamp-2">
            {title}
          </p>
          {meta ? <p className="text-sm text-[var(--muted)]">{meta}</p> : null}
          {statsLine ? <p className="text-xs text-[var(--muted)] mt-1">{statsLine}</p> : null}
          {topicsLine ? <p className="text-xs text-[var(--muted)] mt-1 line-clamp-1">{topicsLine}</p> : null}
          {description ? (
            <p className="text-sm text-[var(--muted)] mt-1.5 line-clamp-1 md:mt-2 md:line-clamp-3">
              {excerpt(description, 132)}
            </p>
          ) : null}
        </div>
      </Link>

      {footer ? <div className="border-t border-[var(--card-border)] px-3 py-2">{footer}</div> : null}
    </div>
  );
}
