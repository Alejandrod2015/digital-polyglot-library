"use client";

import { useEffect, useRef, useState } from "react";
import VocabPanel from "@/components/VocabPanel";
import StoryContent from "@/components/StoryContent";

type VocabItem = { word: string; surface?: string; definition: string; type?: string };

type StoryData = {
  id: string;
  slug: string;
  title: string;
  text: string;
  vocab?: VocabItem[] | null;
  audioUrl?: string | null;
  audioStatus?: string | null;
  language?: string | null;
  level?: string | null;
};

export default function StoryReaderClient({ story }: { story: StoryData }) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ✅ Auto-scroll sincronizado con el progreso del audio (adaptativo al layout)
useEffect(() => {
  const handleAudioProgress = (e: Event) => {
    const custom = e as CustomEvent<number>;
    const ratio = Math.min(1, Math.max(0, custom.detail));
    const el = containerRef.current;
    if (!el) return;

    const mainEl = document.querySelector("main");
    const scrollTarget =
      mainEl && mainEl.scrollHeight > mainEl.clientHeight
        ? mainEl
        : document.scrollingElement || document.documentElement;

    const TITLE_MARGIN = 150;
    const BOTTOM_MARGIN = 380;

    const rect = el.getBoundingClientRect();
    const offsetTop = rect.top + (scrollTarget.scrollTop || 0);
    const maxScroll =
      el.scrollHeight - (scrollTarget.clientHeight - BOTTOM_MARGIN);

    const base = Math.max(0, offsetTop - TITLE_MARGIN);
    const target = base + ratio * maxScroll;

    scrollTarget.scrollTo({
      top: target,
      behavior: "smooth",
    });
  };

  window.addEventListener("audio-progress", handleAudioProgress);
  return () =>
    window.removeEventListener("audio-progress", handleAudioProgress);
}, []);



  // ✅ Detectar clic en palabras con vocabulario
  useEffect(() => {
    const handler = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest?.(
        ".vocab-word"
      ) as HTMLElement | null;
      if (!el) return;

      const word = el.dataset.word ?? "";
      if (!word) return;

      const item = story.vocab?.find((v) => v.word === word || v.surface === word);
      setSelectedWord(item?.word ?? word);
      setDefinition(item?.definition ?? null);
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [story]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="mx-auto max-w-[65ch]"
      >
        <StoryContent
          text={story.text}
          sentencesPerParagraph={3}
          vocab={story.vocab ?? []}
          className="text-xl leading-relaxed text-gray-200 space-y-6"
        />
      </div>


      {selectedWord && (
        <VocabPanel
          key={selectedWord}
          story={{
            id: story.id,
            slug: story.slug,
            title: story.title,
            vocab: story.vocab ?? undefined,
          }}
          initialWord={selectedWord}
          initialDefinition={definition}
          onClose={() => {
            setSelectedWord(null);
            setDefinition(null);
          }}
        />
      )}
    </div>
  );
}
