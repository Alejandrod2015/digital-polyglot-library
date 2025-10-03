"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Story } from "@/types/books";

interface VocabPanelProps {
  story: Story;
}

export default function VocabPanel({ story }: VocabPanelProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  // Buscar el objeto vocab al hacer click en la palabra
  const [definition, setDefinition] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("vocab-word")) {
        const word = target.dataset.word || "";
        setSelectedWord(word);

        // Buscar en vocab de la historia
        const item = story.vocab?.find((v) => v.word === word);
        setDefinition(item?.definition || null);
      }
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [story]);

  if (!selectedWord) return null;

  return (
    <div className="fixed bottom-32 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-gray-800 text-white p-4 rounded-xl shadow-xl z-60">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-bold">{selectedWord}</h3>
        <button
          onClick={() => {
            setSelectedWord(null);
            setDefinition(null);
          }}
        >
          <X className="w-5 h-5 text-gray-400 hover:text-white" />
        </button>
      </div>

      {definition ? (
        <p className="text-gray-300 text-base">{definition}</p>
      ) : (
        <p className="text-gray-500 italic">Sin definición</p>
      )}
    </div>
  );
}
