"use client";

import { useEffect, useRef } from "react";

type JourneyStoryReadTrackerProps = {
  storySlug: string;
  progressKey: string;
  levelId: string;
  topicId: string;
  variantId?: string;
};

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
    const element = sentinelRef.current;
    if (!element || trackedRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || trackedRef.current) return;
        trackedRef.current = true;
        observer.disconnect();

        void fetch("/api/metrics", {
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
            },
          }),
        })
          .then(async (response) => {
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
                },
              })
            );
          })
          .catch(() => {
            trackedRef.current = false;
          });
      },
      {
        threshold: 0.9,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [levelId, progressKey, storySlug, topicId, variantId]);

  return <div ref={sentinelRef} aria-hidden="true" className="h-4 w-full" />;
}
