"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type JourneyStoryReadBannerProps = {
  storySlug: string;
  practiceHref: string;
  journeyHref: string;
};

type ReadEventDetail = {
  storySlug?: string;
};

export default function JourneyStoryReadBanner({
  storySlug,
  practiceHref,
  journeyHref,
}: JourneyStoryReadBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleRead = (event: Event) => {
      const detail =
        event instanceof CustomEvent ? (event.detail as ReadEventDetail | undefined) : undefined;
      if (detail?.storySlug !== storySlug) return;
      setVisible(true);
    };

    window.addEventListener("journey-story-read", handleRead);
    return () => {
      window.removeEventListener("journey-story-read", handleRead);
    };
  }, [storySlug]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[75] md:left-[calc(16rem+1rem)] md:right-4 md:bottom-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200/20 bg-[#0d2648]/95 px-4 py-3 text-white shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">Story read. Your next step is ready.</p>
          <p className="text-xs text-emerald-100/80">
            Practice this topic while the story is still fresh, then keep your journey moving.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href={practiceHref}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
          >
            Practice topic
          </Link>
          <Link
            href={journeyHref}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Back to journey
          </Link>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 bg-transparent px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
