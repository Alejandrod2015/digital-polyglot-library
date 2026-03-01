"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Heart } from "lucide-react";
import { VocabItem } from "@/types/books";
import { useUser } from "@clerk/nextjs";

type FavoriteItem = {
  word: string;
  translation: string;
  exampleSentence?: string;
  storySlug?: string;
  storyTitle?: string;
  sourcePath?: string;
  language?: string;
};

interface VocabPanelProps {
  story: {
    id: string;
    slug: string;
    title: string;
    language?: string | null;
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
  const [selectedSentence, setSelectedSentence] = useState<string | undefined>(undefined);
  const [selectedSourcePath, setSelectedSourcePath] = useState<string | undefined>(undefined);
  const [isFav, setIsFav] = useState(false);
  const [loadedFavs, setLoadedFavs] = useState<FavoriteItem[]>([]);
  const { user, isLoaded } = useUser();

  const persistFavoritesCache = useCallback((items: FavoriteItem[]) => {
    const userCacheKey = `dp_favorites_${user?.id ?? "guest"}`;
    try {
      localStorage.setItem(userCacheKey, JSON.stringify(items));
      // legacy fallback to keep other views in sync
      localStorage.setItem("favorites", JSON.stringify(items));
    } catch {
      // ignore storage errors
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("favorites-updated"));
    }
  }, [user?.id]);

  // 🔹 Cargar favoritos una vez al montar
  useEffect(() => {
    const loadFavorites = async () => {
      const userCacheKey = `dp_favorites_${user?.id ?? "guest"}`;
      const readCache = (): FavoriteItem[] => {
        try {
          const raw = localStorage.getItem(userCacheKey);
          return raw ? (JSON.parse(raw) as FavoriteItem[]) : [];
        } catch {
          return [];
        }
      };

      try {
        if (user) {
          const res = await fetch("/api/favorites", { cache: "no-store" });
          if (res.ok) {
            const favs = (await res.json()) as FavoriteItem[];
            setLoadedFavs(favs);
            persistFavoritesCache(favs);
          } else {
            setLoadedFavs(readCache());
          }
        } else {
          const favs = readCache();
          setLoadedFavs(favs);
        }
      } catch (err) {
        console.error("Error loading favorites:", err);
        setLoadedFavs(readCache());
      }
    };
    if (isLoaded) void loadFavorites();
  }, [user, isLoaded, persistFavoritesCache]);

  // 🔹 Detecta clics sobre palabras con clase .vocab-word
  useEffect(() => {
    const handler = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest?.(
        ".vocab-word"
      ) as HTMLElement | null;
      if (!el) return;

      const word = el.dataset.word ?? "";
      if (!word) return;
      const sentenceNode = el.closest("p, blockquote");
      const sentence = sentenceNode?.textContent?.trim() ?? undefined;

      setSelectedWord(word);
      const item = story.vocab?.find((v) => v.word === word);
      setDefinition(item?.definition ?? null);
      setSelectedSentence(sentence);
      setSelectedSourcePath(
        typeof window !== "undefined" ? window.location.pathname : undefined
      );
      setIsFav(loadedFavs.some((f) => f.word === word));
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [story, loadedFavs]);

  // 🔹 Cierra el panel al hacer tap/clic fuera (ignorando las .vocab-word)
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // No cerrar si el clic viene de una palabra de vocabulario
      if (target.closest(".vocab-word")) return;

      const panel = document.querySelector("#vocab-panel") as HTMLElement | null;
      if (!panel) return;

      if (!panel.contains(target)) {
        setSelectedWord(null);
        setDefinition(null);
        setSelectedSentence(undefined);
        setSelectedSourcePath(undefined);
        setIsFav(false);
        if (onClose) onClose();
      }
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [onClose]);

  // 🔹 Alternar favoritos
  const toggleFavorite = async () => {
    if (!selectedWord) return;
    const newItem: FavoriteItem = {
      word: selectedWord,
      translation: definition ?? "",
      exampleSentence: selectedSentence,
      storySlug: story.slug,
      storyTitle: story.title,
      sourcePath: selectedSourcePath,
      language: story.language ?? undefined,
    };
    const prevFav = isFav;
    const nextFav = !isFav;
    setIsFav(nextFav);

    try {
      const optimistic = prevFav
        ? loadedFavs.filter((f) => f.word !== selectedWord)
        : [...loadedFavs, newItem];
      setLoadedFavs(optimistic);
      persistFavoritesCache(optimistic);

      if (user) {
        const res = await fetch("/api/favorites", {
          method: prevFav ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(prevFav ? { word: selectedWord } : newItem),
        });
        if (!res.ok) throw new Error("Network error");
      } else {
        persistFavoritesCache(optimistic);
      }
    } catch (err) {
      console.error("Error updating favorites:", err);
      // Keep local optimistic state so action still feels responsive offline.
    }
  };

  if (!selectedWord) return null;

  return (
    <div
      id="vocab-panel"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-gray-800 text-white p-4 rounded-xl shadow-xl z-[60]"
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-bold">{selectedWord}</h3>
        <button
          onClick={() => {
            setSelectedWord(null);
            setDefinition(null);
            setSelectedSentence(undefined);
            setSelectedSourcePath(undefined);
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
