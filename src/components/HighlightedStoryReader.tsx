"use client";

import * as React from "react";

import HighlightedStoryContent from "@/components/HighlightedStoryContent";
// IMPORTANT: importar de `audioWordTimingsTypes` (puro) y NO de
// `audioWordTimings` que arrastra prisma al cliente y peta el build
// con "PrismaClient is unable to run in this browser environment".
import {
  coerceAudioWordTimings,
  type AudioWordTimingsPayload,
} from "@/lib/audioWordTimingsTypes";

type VocabItem = { word: string; surface?: string; definition: string; type?: string };

type StoryData = {
  vocab?: VocabItem[] | null;
};

type HighlightedStoryReaderProps = {
  story: StoryData;
  audioWordTimings: unknown;
};

function findActiveWordIndex(
  words: AudioWordTimingsPayload["words"],
  currentTime: number
): number | null {
  // Each token's effective window is [startSec, nextToken.startSec).
  // Aeneas occasionally emits zero-duration windows for short connector
  // words; trusting endSec literally lets those words slip past every
  // sampling tick. Walking startSecs covers them and any inter-word
  // silence transparently.
  let last: number | null = null;
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (w.startSec === null) continue;
    if (currentTime < w.startSec) break;
    let nextStart: number | null = null;
    for (let j = i + 1; j < words.length; j += 1) {
      const candidate = words[j].startSec;
      if (candidate !== null && candidate > w.startSec) {
        nextStart = candidate;
        break;
      }
    }
    if (nextStart === null || currentTime < nextStart) {
      return i;
    }
    last = i;
  }
  return last;
}

export default function HighlightedStoryReader({
  story,
  audioWordTimings,
}: HighlightedStoryReaderProps) {
  const payload = React.useMemo(
    () => coerceAudioWordTimings(audioWordTimings),
    [audioWordTimings]
  );

  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const wordRefs = React.useRef(new Map<number, HTMLSpanElement | null>());
  const containerRef = React.useRef<HTMLDivElement>(null);
  const lastScrolledIndexRef = React.useRef<number | null>(null);

  const setWordRef = React.useCallback((index: number, el: HTMLSpanElement | null) => {
    if (el) wordRefs.current.set(index, el);
    else wordRefs.current.delete(index);
  }, []);

  // Listen to the existing player's audio-progress event, then read the
  // <audio> element's currentTime directly so we get word-level resolution.
  React.useEffect(() => {
    if (!payload || payload.words.length === 0) return;

    const tick = () => {
      const audio = document.querySelector("audio");
      if (!audio) return;
      const ct = audio.currentTime;
      if (!Number.isFinite(ct)) return;
      const idx = findActiveWordIndex(payload.words, ct);
      setActiveIndex(idx);
    };

    const onProgress = () => tick();

    window.addEventListener("audio-progress", onProgress);

    let raf: number | null = null;
    const loop = () => {
      tick();
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("audio-progress", onProgress);
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
  }, [payload]);

  React.useEffect(() => {
    if (activeIndex === null) return;
    if (lastScrolledIndexRef.current === activeIndex) return;
    lastScrolledIndexRef.current = activeIndex;

    const el = wordRefs.current.get(activeIndex);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const buffer = 160;
    const playerSafeZone = viewportH - 280;

    if (rect.top < buffer || rect.bottom > playerSafeZone) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex]);

  if (!payload) {
    // Fail safe: if the JSON payload is malformed, render nothing here.
    // The conditional in page.tsx only mounts this component when the
    // server already validated that audioWordTimings exist.
    return null;
  }

  return (
    <div ref={containerRef} className="relative mx-auto max-w-[65ch]">
      <HighlightedStoryContent
        payload={payload}
        vocab={story.vocab ?? []}
        activeWordIndex={activeIndex}
        onWordRef={setWordRef}
        className="text-xl leading-relaxed text-[var(--foreground)] space-y-6"
      />
    </div>
  );
}
