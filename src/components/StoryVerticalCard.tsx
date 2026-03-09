"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import LevelBadge from "@/components/LevelBadge";
import LanguageBadge from "@/components/LanguageBadge";
import RegionBadge from "@/components/RegionBadge";

type StoryVerticalCardProps = {
  href: string;
  title: string;
  coverUrl?: string;
  subtitle?: string;
  excerpt?: string;
  meta?: string;
  metaSecondary?: string;
  level?: string;
  language?: string;
  region?: string;
  className?: string;
  footer?: ReactNode;
};

export default function StoryVerticalCard({
  href,
  title,
  coverUrl,
  subtitle,
  excerpt,
  meta,
  metaSecondary,
  level,
  language,
  region,
  className = "",
  footer,
}: StoryVerticalCardProps) {
  return (
    <div
      className={`flex flex-col rounded-2xl overflow-hidden border border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] transition-all duration-200 shadow-md ${className}`}
    >
      <Link
        href={href}
        className="flex flex-col"
      >
        <div className="w-full h-48 bg-[var(--surface)]">
          <img
            src={coverUrl || "/covers/default.jpg"}
            alt={title}
            className="object-cover w-full h-full"
          />
        </div>

        <div className="p-5 text-left">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <LevelBadge level={level} />
              <LanguageBadge language={language} />
              <RegionBadge region={region} />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] line-clamp-2">{title}</h3>
            {subtitle ? (
              <p className="text-[var(--primary)] text-sm leading-relaxed line-clamp-1">{subtitle}</p>
            ) : null}
            {excerpt ? <p className="mt-2 text-sm text-[var(--muted)] line-clamp-3">{excerpt}</p> : null}
          </div>

          {(meta || metaSecondary) && (
            <div className="mt-3 text-sm text-[var(--muted)] space-y-1">
              {meta ? <p>{meta}</p> : null}
              {metaSecondary ? <p>{metaSecondary}</p> : null}
            </div>
          )}
        </div>
      </Link>

      {footer ? <div className="border-t border-[var(--card-border)] px-3 py-2">{footer}</div> : null}
    </div>
  );
}
