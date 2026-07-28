"use client";

import * as React from "react";

import HighlightedStoryContent from "@/components/HighlightedStoryContent";
// IMPORTANT: importar de `audioWordTimingsTypes` (puro) y NO de
// `audioWordTimings` que arrastra prisma al cliente y peta el build
// con "PrismaClient is unable to run in this browser environment".
import { coerceAudioWordTimings } from "@/lib/audioWordTimingsTypes";
import { buildWordWindows, findActiveWordIndex } from "@/lib/karaokeWordWindows";

type VocabItem = { word: string; surface?: string; definition: string; type?: string };

type StoryData = {
  vocab?: VocabItem[] | null;
};

type HighlightedStoryReaderProps = {
  story: StoryData;
  audioWordTimings: unknown;
};

export default function HighlightedStoryReader({
  story,
  audioWordTimings,
}: HighlightedStoryReaderProps) {
  const payload = React.useMemo(
    () => coerceAudioWordTimings(audioWordTimings),
    [audioWordTimings]
  );

  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  // Aquí vivía un parche que escalaba el tiempo de consulta por
  // `span/duración` (tope 6%) porque los timings se pasaban hasta ~0.8s del
  // final real del audio. Ese desborde lo causaba `correctAlignmentDrift`, ya
  // eliminado: los timings van crudos de aeneas y encajan solos. Verificado
  // sobre los 354 payloads guardados el 2026-07-28; el único que aún se pasa
  // es de una historia sin `audioUrl`, que por tanto nunca reproduce audio.
  // Si algún día vuelve a haber desborde, el arreglo va en el alineador, no
  // en un factor de escala aquí.

  // Ventanas de resaltado precalculadas. Aeneas repite el mismo startSec en
  // palabras contiguas (7.2% de las palabras medidas), y con la búsqueda
  // anterior sólo ganaba la primera del empate: las demás no se encendían
  // NUNCA. Aquí cada empate se reparte dentro de su propio tramo.
  const wordWindows = React.useMemo(
    () => (payload ? buildWordWindows(payload.words, payload.audioDurationSec) : []),
    [payload]
  );

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
    if (wordWindows.length === 0) return;

    const tick = () => {
      const audio = document.querySelector("audio");
      if (!audio) return;
      const ct = audio.currentTime;
      if (!Number.isFinite(ct)) return;
      const idx = findActiveWordIndex(wordWindows, ct);
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
  }, [wordWindows]);

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
