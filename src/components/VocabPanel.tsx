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
    vocab?: VocabItem[];
  };
  initialWord?: string | null;
  initialDefinition?: string | null;
  onClose?: () => void;
}

export default function VocabPanel({
  story,
  initialWord = null,
  initialDefinition = null,
  onClose,
}: VocabPanelProps) {
  const [selectedWord, setSelectedWord] = useState(initialWord);
  const [definition, setDefinition] = useState(initialDefinition);
  const [isFav, setIsFav] = useState(false);
  const [loadedFavs, setLoadedFavs] = useState<FavoriteItem[]>([]);
  const { user, isLoaded } = useUser();

  // 🔹 Cargar favoritos una vez al montar
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        if (user) {
          const res = await fetch("/api/favorites", { cache: "no-store" });
          if (res.ok) {
            const favs = (await res.json()) as FavoriteItem[];
            setLoadedFavs(favs);
          }
        } else {
          const stored = localStorage.getItem("favorites");
          const favs = stored ? (JSON.parse(stored) as FavoriteItem[]) : [];
          setLoadedFavs(favs);
        }
      } catch (err) {
        console.error("Error loading favorites:", err);
        setLoadedFavs([]);
      }
    };
    if (isLoaded) void loadFavorites();
  }, [user, isLoaded]);

  // 🔹 Actualiza el estado cuando cambia la palabra inicial
  useEffect(() => {
    if (initialWord) {
      setSelectedWord(initialWord);
      setDefinition(initialDefinition);
      setIsFav(loadedFavs.some((f) => f.word === initialWord));
    }
  }, [initialWord, initialDefinition, loadedFavs]);

  // 🔹 Alternar favoritos
  const toggleFavorite = async () => {
    if (!selectedWord) return;
    const newItem = { word: selectedWord, translation: definition ?? "" };
    const prevFav = isFav;
    setIsFav(!isFav);

    try {
      if (user) {
        const res = await fetch("/api/favorites", {
          method: isFav ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(isFav ? { word: selectedWord } : newItem),
        });
        if (!res.ok) throw new Error("Network error");
      } else {
        const updated = isFav
          ? loadedFavs.filter((f) => f.word !== selectedWord)
          : [...loadedFavs, newItem];
        localStorage.setItem("favorites", JSON.stringify(updated));
        setLoadedFavs(updated);
      }
    } catch (err) {
      console.error("Error updating favorites:", err);
      setIsFav(prevFav);
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
            if (onClose) onClose();
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
              ? "bg-red-600 hover:bg-red-700"
              : "bg-blue-600 hover:bg-blue-700"
          } text-white`}
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
