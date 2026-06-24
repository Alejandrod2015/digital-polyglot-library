"use client";

import { useState, useEffect, useCallback } from "react";
import { Heart, X } from "lucide-react";
import { VocabItem } from "@/types/books";
import { useUser } from "@clerk/nextjs";
import { normalizeVocabType, getVocabTypeLabel, type VocabTypeKey } from "@/lib/vocabTypes";
import {
  coerceAudioSegments,
  findBestAudioSegment,
  splitStoryTextIntoSentences,
} from "@/lib/audioSegments";

type FavoriteItem = {
  word: string;
  translation: string;
  wordType?: string | null;
  exampleSentence?: string;
  storySlug?: string;
  storyTitle?: string;
  sourcePath?: string;
  language?: string;
};

function compactSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getContextSentence(raw: string | undefined, word: string): string | undefined {
  if (!raw) return undefined;
  const clean = compactSpaces(raw);
  if (!clean) return undefined;

  const normalizedWord = compactSpaces(word).toLowerCase();
  const sentences = splitStoryTextIntoSentences(clean);

  const bestSentence =
    sentences.find((s) => s.toLowerCase().includes(normalizedWord)) ?? sentences[0] ?? clean;
  return bestSentence || undefined;
}

const MAX_CONTEXT_CHARS = 160;

// Mirror del catálogo de fondos del bubble de iPhone
// (ReaderScreen.tsx → VOCAB_TYPE_BACKGROUNDS). Mantener en sync para
// que la asociación pill→popup se sienta exactamente igual.
const VOCAB_TYPE_BG: Record<VocabTypeKey, string> = {
  verb: "rgba(248, 113, 113, 0.6)",
  noun: "rgba(56, 189, 248, 0.65)",
  adjective: "rgba(52, 211, 153, 0.6)",
  adverb: "rgba(167, 139, 250, 0.65)",
  pronoun: "rgba(251, 191, 36, 0.6)",
  preposition: "rgba(45, 212, 191, 0.6)",
  conjunction: "rgba(129, 140, 248, 0.6)",
  number: "rgba(190, 220, 80, 0.55)",
  expression: "rgba(244, 114, 182, 0.6)",
  other: "rgba(148, 163, 184, 0.55)",
};

function shortenContext(raw: string | undefined, word: string): string | undefined {
  if (!raw) return undefined;
  const clean = compactSpaces(raw);
  if (!clean) return undefined;

  const normalizedWord = compactSpaces(word).toLowerCase();
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const bestSentence =
    sentences.find((s) => s.toLowerCase().includes(normalizedWord)) ?? sentences[0] ?? clean;

  if (bestSentence.length <= MAX_CONTEXT_CHARS) return bestSentence;
  return `${bestSentence.slice(0, MAX_CONTEXT_CHARS - 1).trimEnd()}…`;
}

interface VocabPanelProps {
  story: {
    id: string;
    slug: string;
    title: string;
    language?: string | null;
    source?: "polyglot" | "standalone";
    vocab?: VocabItem[];
    audioSegments?: unknown;
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
  // Sit the bubble ABOVE the audio player dock so it never covers the
  // controls (desktop or mobile). Measure the real dock height at runtime
  // (#story-player-dock) instead of a fixed guess — the old static 98px
  // assumed a ~92px dock, but the web player is taller (waveform + controls
  // ≈ 130-140px) so the bubble overlapped it. Fallback clears a tall dock.
  const [dockBottom, setDockBottom] = useState<string>(
    "max(150px, calc(140px + env(safe-area-inset-bottom) + 12px))"
  );
  useEffect(() => {
    const measure = () => {
      const dock = document.getElementById("story-player-dock");
      const h = dock?.getBoundingClientRect().height ?? 0;
      if (h > 0) setDockBottom(`calc(${Math.ceil(h)}px + 12px + env(safe-area-inset-bottom))`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [selectedWord]);
  const { user, isLoaded } = useUser();
  const storyAudioSegments = coerceAudioSegments(story.audioSegments);

  const buildSourcePath = useCallback(
    (sentence: string | undefined, word: string): string | undefined => {
      if (typeof window === "undefined") return undefined;

      if (story.source !== "standalone") {
        if (process.env.NODE_ENV !== "production") {
          console.debug("[vocab-panel] polyglot source path", {
            storySlug: story.slug,
            word,
            sentence,
            sourcePath: window.location.pathname,
          });
        }
        return window.location.pathname;
      }

      const path = `${window.location.pathname}?source=${story.source ?? "polyglot"}`;
      if (!sentence) return path;

      const segment = findBestAudioSegment(storyAudioSegments, sentence, {
        targetWord: story.source === "standalone" ? word : null,
      });
      if (process.env.NODE_ENV !== "production") {
        console.debug("[vocab-panel] standalone segment lookup", {
          storySlug: story.slug,
          word,
          sentence,
          segmentId: segment?.id ?? null,
        });
      }
      if (!segment) return path;

      const url = new URL(path, window.location.origin);
      url.searchParams.set("segmentId", segment.id);
      return `${url.pathname}${url.search}`;
    },
    [story.source, storyAudioSegments]
  );

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
      const sentence =
        story.source === "standalone"
          ? getContextSentence(sentenceNode?.textContent ?? undefined, word)
          : shortenContext(sentenceNode?.textContent ?? undefined, word);
      const normalizedWord = word.trim().toLowerCase();

      const item = story.vocab?.find((v) => {
        const vocabWord = typeof v.word === "string" ? v.word.trim().toLowerCase() : "";
        const vocabSurface = typeof v.surface === "string" ? v.surface.trim().toLowerCase() : "";
        return vocabWord === normalizedWord || vocabSurface === normalizedWord;
      });
      setSelectedWord(item?.word ?? word);
      setDefinition(item?.definition ?? null);
      setSelectedSentence(sentence);
      setSelectedSourcePath(buildSourcePath(sentence, word));
      if (process.env.NODE_ENV !== "production") {
        console.debug("[vocab-panel] selected vocab word", {
          storySlug: story.slug,
          source: story.source ?? "polyglot",
          word,
          sentence,
        });
      }
      setIsFav(
        loadedFavs.some((f) => (f.word ?? "").trim().toLowerCase() === normalizedWord)
      );
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [buildSourcePath, story, loadedFavs]);

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
      wordType:
        normalizeVocabType(
          story.vocab?.find((v) => v.word === selectedWord || v.surface === selectedWord)?.type,
          { word: selectedWord, definition: definition ?? "" }
        ) ?? null,
      exampleSentence: selectedSentence,
      storySlug: story.slug,
      storyTitle: story.title,
      sourcePath: selectedSourcePath,
      language: story.language ?? undefined,
    };
    if (process.env.NODE_ENV !== "production") {
      console.debug("[vocab-panel] saving favorite", newItem);
    }
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

  const handleClose = () => {
    setSelectedWord(null);
    setDefinition(null);
    setSelectedSentence(undefined);
    setSelectedSourcePath(undefined);
    setIsFav(false);
    if (onClose) onClose();
  };

  // Tipo normalizado del vocab seleccionado para pintar el badge.
  const selectedType: VocabTypeKey | null = selectedWord
    ? normalizeVocabType(
        story.vocab?.find(
          (v) => v.word === selectedWord || v.surface === selectedWord
        )?.type,
        { word: selectedWord, definition: definition ?? "" }
      )
    : null;

  if (!selectedWord) return null;

  return (
    // Overlay flotante: la burbuja vive justo arriba del Player dock, no
    // como un bottom-sheet full-width. `pointer-events-none` deja pasar
    // taps en las palabras detrás del overlay (para saltar de una a otra
    // sin cerrar primero); la burbuja reactiva eventos con
    // `pointer-events-auto`. Mismo patrón que ReaderScreen.tsx en iPhone.
    //
    // El Player web (Player.tsx) mide ~110px (progress bar + controls +
    // px-4 py-3). Le sumamos 12px de gap y el safe-area-inset-bottom para
    // que la burbuja no quede sobre el dock. Se hace por inline style
    // porque Tailwind v4 JIT a veces tira `pb-[max(...,calc(...))]`.
    <div
      id="vocab-panel"
      // Posicionado directamente, SIN wrapper outer con
      // `pointer-events-none`. La burbuja ahora ES el contenedor fijo:
      // ocupa sólo su propio espacio, así los clicks fuera de ella
      // pasan naturalmente a las palabras detrás (no necesita el truco
      // de pointer-events-none que estaba causando que los botones
      // internos no reciban touch en móvil). Centrado horizontal con
      // left:50% + translateX(-50%); en desktop el media query CSS lo
      // re-centra sobre el main offset por el sidebar.
      className="fixed z-[70] vocab-overlay-wrap"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        bottom: dockBottom,
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 36px)",
        maxWidth: 448,
        // Tokens en vez de hex: en dark mode el browser pinta navy
        // (--surface/--card-border valores dark); en light pinta white
        // card con la sombra del token. Antes los hex hardcoded
        // dejaban el panel dark sobre cream.
        background: "var(--surface)",
        border: "1px solid var(--card-border)",
        borderRadius: 20,
        padding: "16px 18px",
        boxShadow: "var(--shadow-card, 0 8px 14px rgba(0,0,0,0.22))",
      }}
      aria-label="qa-reader-vocab-bubble"
    >
        {/* Header: word + type badge (left) · close × (right) */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 flex-col gap-0.5 min-w-0">
            <span
              className="text-white truncate"
              style={{ fontSize: 22, fontWeight: 800 }}
            >
              {selectedWord}
            </span>
            {selectedType && selectedType !== "other" ? (
              <span
                className="self-start"
                style={{
                  backgroundColor: VOCAB_TYPE_BG[selectedType],
                  color: "#ffffff",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: 999,
                  marginTop: 4,
                }}
              >
                {getVocabTypeLabel(selectedType)}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (process.env.NODE_ENV !== "production") {
                console.log("[vocab-panel] close button clicked");
              }
              handleClose();
            }}
            aria-label="Close"
            className="shrink-0 grid place-items-center cursor-pointer"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              backgroundColor: "var(--chip-bg)",
              color: "var(--foreground)",
              border: "1px solid var(--chip-border)",
            }}
          >
            <X size={16} strokeWidth={2.6} style={{ pointerEvents: "none" }} />
          </button>
        </div>

        {/* Definition */}
        {definition ? (
          <p
            className="mt-1.5 text-[var(--foreground)]"
            style={{ fontSize: 15, lineHeight: "22px" }}
          >
            {definition}
          </p>
        ) : (
          <p className="text-white/50 italic mt-1.5" style={{ fontSize: 15 }}>
            No definition available
          </p>
        )}

        {/* Action row: save chip — cyan glow at rest, gold when active */}
        <div className="mt-3 flex">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (process.env.NODE_ENV !== "production") {
                console.log("[vocab-panel] save button clicked");
              }
              void toggleFavorite();
            }}
            aria-label={isFav ? "Remove from saved words" : "Save word"}
            className="inline-flex items-center gap-2 transition-all cursor-pointer"
            style={
              isFav
                ? {
                    backgroundColor: "#f8c15c",
                    border: "1px solid rgba(248, 193, 92, 0.95)",
                    color: "#0e1727",
                    fontWeight: 800,
                    fontSize: 14,
                    letterSpacing: "0.012em",
                    padding: "10px 16px",
                    borderRadius: 999,
                    boxShadow: "0 4px 12px rgba(248, 193, 92, 0.45)",
                  }
                : {
                    // Tokens en vez de hex: en light el botón Save
                    // queda gris-cream con foreground dark; en dark
                    // mantiene look navy con borde cyan.
                    backgroundColor: "var(--chip-bg)",
                    border: "1px solid var(--card-border)",
                    color: "var(--foreground)",
                    fontWeight: 700,
                    fontSize: 14,
                    letterSpacing: "0.012em",
                    padding: "10px 16px",
                    borderRadius: 999,
                    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.18)",
                  }
            }
          >
            <Heart
              size={16}
              strokeWidth={2.4}
              fill={isFav ? "currentColor" : "none"}
            />
            {isFav ? "Saved" : "Save word"}
          </button>
        </div>
    </div>
  );
}
