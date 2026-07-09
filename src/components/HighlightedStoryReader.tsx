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

  // Los timings de aeneas (sobre todo ES/DE) se corren TARDE de forma
  // acumulada: el último endSec cae hasta ~0.7-0.8s DESPUÉS del final real del
  // audio (la corrección de drift ancla al final del silencio). Efecto: el
  // resaltado empieza sincronizado y se va atrasando hacia el final. Fix de
  // primer orden: al buscar la palabra activa, escalamos el tiempo de consulta
  // por `span/duración`, repartiendo el atraso hacia atrás proporcionalmente.
  // Es no-op cuando los timings ya encajan en el audio (span <= duración).
  const timingsSpanSec = React.useMemo(() => {
    if (!payload) return 0;
    let span = 0;
    for (const w of payload.words) {
      const end = typeof w.endSec === "number" ? w.endSec : w.startSec;
      if (typeof end === "number" && end > span) span = end;
    }
    return span;
  }, [payload]);

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
      // Compensa el atraso acumulado escalando el tiempo de consulta hacia
      // adelante cuando los timings se pasan del final real. Cap al 6% para no
      // sobrecorregir si algún dato viniera raro; factor=1 (no-op) si encajan.
      const dur = audio.duration;
      let queryTime = ct;
      if (Number.isFinite(dur) && dur > 0 && timingsSpanSec > dur) {
        queryTime = ct * Math.min(timingsSpanSec / dur, 1.06);
      }
      const idx = findActiveWordIndex(payload.words, queryTime);
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
  }, [payload, timingsSpanSec]);

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
