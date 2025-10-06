"use client";

import { useState, useEffect } from "react";
import { X, Heart } from "lucide-react";
import { VocabItem } from "@/types/books";

type FavoriteItem = {
  word: string;
  translation: string;
};

interface VocabPanelProps {
  story: {
    id: string;
    slug: string;
    title: string;
    text: string;
    audio: string;
    vocab?: VocabItem[];
  };
}

export default function VocabPanel({ story }: VocabPanelProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);

  // Detect clicks on words with "vocab-word" class
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("vocab-word")) {
        const word = target.dataset.word || "";
        setSelectedWord(word);

        const item = story.vocab?.find((v) => v.word === word);
        setDefinition(item?.definition ?? null);
      }
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [story]);

  // Sync favorites state when a new word is selected
  useEffect(() => {
    if (!selectedWord) return;
    try {
      const stored = JSON.parse(localStorage.getItem("favorites") || "[]");
      setIsFav((stored as FavoriteItem[]).some((f) => f.word === selectedWord));
    } catch {
      setIsFav(false);
    }
  }, [selectedWord]);

  const toggleFavorite = () => {
    if (!selectedWord) return;
    try {
      const stored = JSON.parse(localStorage.getItem("favorites") || "[]");

      if (isFav) {
        // Remove from favorites
        const updated = (stored as FavoriteItem[]).filter((f) => f.word !== selectedWord);
        localStorage.setItem("favorites", JSON.stringify(updated));
        setIsFav(false);
      } else {
        // Add to favorites
        const newItem = {
          word: selectedWord,
          translation: definition ?? "",
        };
        const updated = [...stored, newItem];
        localStorage.setItem("favorites", JSON.stringify(updated));
        setIsFav(true);
      }
    } catch {
      // Fail silently
    }
  };

  if (!selectedWord) return null;

  return (
    <div className="fixed bottom-32 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-gray-800 text-white p-4 rounded-xl shadow-xl z-60">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-bold">{selectedWord}</h3>
        <button
          onClick={() => {
            setSelectedWord(null);
            setDefinition(null);
            setIsFav(false);
          }}
          aria-label="Close vocab panel"
        >
          <X className="w-5 h-5 text-gray-400 hover:text-white" />
        </button>
      </div>

      {definition ? (
        <p className="text-gray-300 text-base">{definition}</p>
      ) : (
        <p className="text-gray-500 italic">No definition available</p>
      )}

      <div className="mt-4">
        <button
          onClick={toggleFavorite}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 transition ${
            isFav
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          <Heart
            className={`w-4 h-4 ${
              isFav ? "fill-red-400 text-red-400" : "text-white"
            }`}
          />
          {isFav ? "Remove from Favorites" : "Add to Favorites"}
        </button>
      </div>
    </div>
  );
}
