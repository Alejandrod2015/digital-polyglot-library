"use client";

import React from "react";
import StoryContent from "@/components/StoryContent";
import TapGlossLayer from "@/components/TapGlossLayer";
import type { TapGloss } from "@/lib/tapGlosses";

// Piloto "tap any word" (2026-07-06) para el path SIN word timings:
// envuelve StoryContent marcando cada palabra con gloss como span
// .tap-word. La burbuja y el listener viven en TapGlossLayer (compartida
// con el path de karaoke, donde los spans [data-word-index] ya existen).
type TapGlossReaderProps = {
  text: string;
  vocab: Array<{ word: string; surface?: string; definition: string; type?: string; register?: string }>;
  glosses: Record<string, TapGloss>;
  story?: { slug: string; title: string; language?: string | null };
};

const WORD_SPLIT = /([A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*)/u;

export default function TapGlossReader({ text, vocab, glosses, story }: TapGlossReaderProps) {
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

  return (
    <div className="relative">
      <StoryContent
        text={text}
        sentencesPerParagraph={3}
        vocab={vocab}
        renderWord={renderWord}
      />
      <TapGlossLayer glosses={glosses} story={story} />
    </div>
  );
}
