"use client";

import { Book, Story } from "@/types/books";
import { useEffect, useRef } from "react";
import Player from "@/components/Player";

export default function StoryReaderClient({ book, story }: { book: Book; story: Story }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // ✅ Auto-scroll sincronizado con progreso del audio (funciona con el nuevo layout)
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
    return () => window.removeEventListener("audio-progress", handleAudioProgress);
  }, []);

  // ✅ Reset de scroll al cambiar de historia
  useEffect(() => {
    const scrollTarget =
      document.querySelector("main") ||
      document.scrollingElement ||
      document.documentElement;
    scrollTarget.scrollTo({ top: 0 });
  }, [story.slug]);

  return (
    <div className="text-gray-100">
      {/* 🔹 Texto principal */}
      <div
        ref={containerRef}
        className="space-y-4 text-xl leading-relaxed text-gray-200"
        dangerouslySetInnerHTML={{ __html: story.text }}
      />

      {/* 🔹 Player fijo */}
      <div className="fixed bottom-0 left-0 w-full z-50">
        <Player
          src={story.audio || `/audio/${book.slug}/${story.slug}.mp3`}
          bookSlug={book.slug}
          storySlug={story.slug}
        />
      </div>
    </div>
  );
}
