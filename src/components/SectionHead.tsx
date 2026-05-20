"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  title: string;
  sub?: string;
  seeAllHref?: string;
  onPrev?: () => void;
  onNext?: () => void;
};

/**
 * Section heading row used above each carousel/grid on Home.
 * - Title (22/900) + optional sub (13/700/muted) on the left.
 * - "See all" gold link + optional prev/next arrows on the right.
 *
 * Pass onPrev/onNext to wire Embla scroll buttons.
 */
export default function SectionHead({
  title,
  sub,
  seeAllHref,
  onPrev,
  onNext,
}: Props) {
  return (
    <header className="flex items-center justify-between gap-5 mb-4">
      <div className="flex flex-col gap-0.5 min-w-0">
        <h2 className="text-[22px] font-black tracking-[-0.02em] leading-tight text-[var(--foreground)] m-0">
          {title}
        </h2>
        {sub && (
          <span className="text-[13px] font-bold text-[var(--muted)]">
            {sub}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[var(--color-gold)] px-3 py-1.5 rounded-full hover:bg-[rgba(252,211,77,0.16)] whitespace-nowrap transition-colors"
          >
            See all <ArrowRight size={14} />
          </Link>
        )}
        {(onPrev || onNext) && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onPrev}
              aria-label="Previous"
              className="w-[34px] h-[34px] rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] grid place-items-center text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="Next"
              className="w-[34px] h-[34px] rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] grid place-items-center text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
