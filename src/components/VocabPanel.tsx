"use client";

import { useState, useEffect } from "react";
import { X, Heart } from "lucide-react";
import { VocabItem } from "@/types/books";
import { useUser } from "@clerk/nextjs";

type FavoriteItem = { word: string; translation: string };

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

  // Detecta clicks incluso si el target es un TextNode
  useEffect(() => {
    const handler = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest?.(
        ".vocab-word"
      ) as HTMLElement | null;
      if (!el) return;

      const word = el.dataset.word ?? "";
      if (!word) return;

      setSelectedWord(word);
      const item = story.vocab?.find((v) => v.word === word);
      setDefinition(item?.definition ?? null);
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [story]);

  useEffect(() => {
    if (!selectedWord) return;
    try {
      const stored = JSON.parse(localStorage.getItem("favorites") || "[]") as FavoriteItem[];
      setIsFav(stored.some((f) => f.word === selectedWord));
    } catch {
      setIsFav(false);
    }
  }, [selectedWord]);

  const { user } = useUser();

const toggleFavorite = async () => {
  if (!selectedWord) return;

  const newItem = { word: selectedWord, translation: definition ?? "" };

  try {
    if (user) {
      // 🔹 Usuario logueado → usar backend
      if (isFav) {
        await fetch("/api/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // 👈 necesario para Clerk
      body: JSON.stringify({ word: selectedWord }),
    });

        setIsFav(false);
      } else {
        await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // 👈 envía cookies de Clerk
      body: JSON.stringify(newItem),
    });

        setIsFav(true);
      }
    } else {
      // 🔹 Usuario anónimo → usar localStorage
      const stored = JSON.parse(localStorage.getItem("favorites") || "[]") as FavoriteItem[];
      if (isFav) {
        const updated = stored.filter((f) => f.word !== selectedWord);
        localStorage.setItem("favorites", JSON.stringify(updated));
        setIsFav(false);
      } else {
        const updated = [...stored, newItem];
        localStorage.setItem("favorites", JSON.stringify(updated));
        setIsFav(true);
      }
    }
  } catch (err) {
    console.error("Error updating favorites:", err);
  }
};

  if (!selectedWord) return null;

  return (
    <div className="fixed bottom-40 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-gray-800 text-white p-4 rounded-xl shadow-xl z-[60]">
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
            isFav ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
          } text-white`}
        >
          <Heart className={`w-4 h-4 ${isFav ? "fill-red-400 text-red-400" : "text-white"}`} />
          {isFav ? "Remove from Favorites" : "Add to Favorites"}
        </button>
      </div>
    </div>
  );
}
