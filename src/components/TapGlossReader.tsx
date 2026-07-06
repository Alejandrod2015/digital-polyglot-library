"use client";

import React from "react";
import StoryContent from "@/components/StoryContent";

// Piloto "tap any word" (2026-07-06): envuelve el StoryContent existente.
// Cada palabra con gloss precomputado se renderiza como span.tap-word;
// al tocarla aparece un tooltip con el significado. Las pills curadas
// (.vocab-word) tienen prioridad: su click sigue yendo al VocabPanel.
type TapGlossReaderProps = {
  text: string;
  vocab: Array<{ word: string; surface?: string; definition: string; type?: string }>;
  glosses: Record<string, string>;
};

type TooltipState = {
  word: string;
  gloss: string;
  x: number;
  y: number;
};

const WORD_SPLIT = /([A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*)/u;

export default function TapGlossReader({ text, vocab, glosses }: TapGlossReaderProps) {
  const [tooltip, setTooltip] = React.useState<TooltipState | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const renderWord = React.useCallback(
    (chunk: string): React.ReactNode => {
      const parts = chunk.split(WORD_SPLIT);
      if (parts.length === 1) return chunk;
      return parts.map((part, i) => {
        if (i % 2 === 1) {
          const key = part.toLowerCase();
          if (glosses[key]) {
            return (
              <span key={i} className="tap-word cursor-pointer" data-token={key}>
                {part}
              </span>
            );
          }
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      });
    },
    [glosses]
  );

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Las pills curadas mandan: su click lo maneja el VocabPanel.
      if (target.closest(".vocab-word")) {
        setTooltip(null);
        return;
      }
      const el = target.closest(".tap-word") as HTMLElement | null;
      if (!el) {
        setTooltip(null);
        return;
      }
      const token = el.dataset.token ?? "";
      const gloss = glosses[token];
      if (!gloss) return;
      const rect = el.getBoundingClientRect();
      setTooltip({
        word: el.textContent ?? token,
        gloss,
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    };
    const dismiss = () => setTooltip(null);
    document.addEventListener("click", handler);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("click", handler);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [glosses]);

  return (
    <div ref={rootRef} className="relative">
      <StoryContent
        text={text}
        sentencesPerParagraph={3}
        vocab={vocab}
        renderWord={renderWord}
      />
      {tooltip ? (
        <div
          className="fixed z-[60] max-w-xs -translate-x-1/2 -translate-y-full rounded-xl border border-white/15 bg-[#102746] px-4 py-2.5 text-sm shadow-2xl"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          <div className="font-semibold text-white">{tooltip.word}</div>
          <div className="mt-0.5 text-blue-100/85">{tooltip.gloss}</div>
        </div>
      ) : null}
    </div>
  );
}
