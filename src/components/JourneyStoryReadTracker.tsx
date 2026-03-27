"use client";

import { useEffect, useRef } from "react";

type JourneyStoryReadTrackerProps = {
  storySlug: string;
  progressKey: string;
  levelId: string;
  topicId: string;
  variantId?: string;
};

const JOURNEY_READ_PROGRESS_THRESHOLD = 0.35;

export default function JourneyStoryReadTracker({
  storySlug,
  progressKey,
  levelId,
  topicId,
  variantId,
}: JourneyStoryReadTrackerProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const trackedRef = useRef(false);

  useEffect(() => {
    async function markRead(progressRatio?: number) {
      if (trackedRef.current) return;
      trackedRef.current = true;

      try {
        const response = await fetch("/api/metrics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storySlug,
            eventType: "journey_story_read",
            metadata: {
              progressKey,
              levelId,
              topicId,
              variantId,
              source: "journey",
              ...(typeof progressRatio === "number" && Number.isFinite(progressRatio)
                ? { progressRatio: Math.max(0, Math.min(1, progressRatio)) }
                : {}),
            },
          }),
        });

        if (!response.ok) {
          trackedRef.current = false;
          return;
        }

        window.dispatchEvent(
          new CustomEvent("journey-story-read", {
            detail: {
              storySlug,
              levelId,
              topicId,
              variantId,
              progressRatio,
            },
          })
        );
      } catch {
        trackedRef.current = false;
      }
    }

    const element = sentinelRef.current;
    if (!element || trackedRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || trackedRef.current) return;
        observer.disconnect();
        void markRead(1);
      },
      {
        threshold: 0.9,
      }
    );

    const handleProgress = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as
        | {
            storySlug?: string;
            progressSec?: number;
            audioDurationSec?: number;
          }
        | undefined;
      if (detail?.storySlug !== storySlug) return;

      const progressSec =
        typeof detail.progressSec === "number" && Number.isFinite(detail.progressSec)
          ? detail.progressSec
          : 0;
      const audioDurationSec =
        typeof detail.audioDurationSec === "number" && Number.isFinite(detail.audioDurationSec)
          ? detail.audioDurationSec
          : 0;
      if (audioDurationSec <= 0) return;

      const progressRatio = Math.max(0, Math.min(1, progressSec / audioDurationSec));
      if (progressRatio < JOURNEY_READ_PROGRESS_THRESHOLD) return;

      observer.disconnect();
      void markRead(progressRatio);
    };

    observer.observe(element);
    window.addEventListener("continue-listening-updated", handleProgress);

    return () => {
      observer.disconnect();
      window.removeEventListener("continue-listening-updated", handleProgress);
    };
  }, [levelId, progressKey, storySlug, topicId, variantId]);

  return <div ref={sentinelRef} aria-hidden="true" className="h-4 w-full" />;
}
