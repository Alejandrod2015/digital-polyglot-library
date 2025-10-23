"use client";

import { useState } from "react";
import VocabPanel from "@/components/VocabPanel";

type VocabItem = { word: string; definition: string };

type StoryData = {
  id: string;
  slug: string;
  title: string;
  text: string;
  vocab?: VocabItem[] | null;
  audioUrl?: string | null;
  language?: string | null;
  level?: string | null;
};

export default function StoryReaderClient({ story }: { story: StoryData }) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);

  const handleWordClick = (word: string) => {
    const item = story.vocab?.find((v) => v.word === word);
    setSelectedWord(word);
    setDefinition(item?.definition ?? null);
  };

  return (
    <div className="relative">
      <div
        className="
          space-y-4
          text-xl
          leading-relaxed
          text-gray-200
          mx-auto
          max-w-[70ch]
        "
        onClick={(e) => {
          const target = (e.target as HTMLElement).closest(".vocab-word") as HTMLElement | null;
          if (target) {
            const word = target.dataset.word ?? "";
            if (word) handleWordClick(word);
          }
        }}
        dangerouslySetInnerHTML={{ __html: story.text }}
      />

      {selectedWord && (
  <VocabPanel
    key={selectedWord} // 🔹 fuerza un remount al cambiar la palabra
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
