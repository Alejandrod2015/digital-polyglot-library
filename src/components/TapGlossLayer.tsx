"use client";

import React from "react";
import { Heart, Search, X } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import type { TapGloss } from "@/lib/tapGlosses";
import {
  getVocabTypeLabel,
  getVocabRegisterLabel,
  normalizeVocabRegister,
  normalizeVocabType,
  type VocabRegisterKey,
  type VocabTypeKey,
} from "@/lib/vocabTypes";

// Capa de diccionario del piloto tap-any-word (2026-07-06): burbuja
// "Quick lookup" + listener global de clicks. Reutilizada por los DOS
// paths del reader: StoryContent (spans .tap-word que crea TapGlossReader)
// y el karaoke HighlightedStoryContent (spans [data-word-index] que ya
// existen para el highlight por palabra). Las pills curadas (.vocab-word)
// tienen prioridad: su click lo maneja el VocabPanel.
const VOCAB_TYPE_BG: Record<VocabTypeKey, string> = {
  verb: "rgba(248, 113, 113, 0.6)",
  noun: "rgba(56, 189, 248, 0.65)",
  adjective: "rgba(52, 211, 153, 0.6)",
  adverb: "rgba(167, 139, 250, 0.65)",
  pronoun: "rgba(251, 191, 36, 0.6)",
  preposition: "rgba(45, 212, 191, 0.6)",
  conjunction: "rgba(129, 140, 248, 0.6)",
  article: "rgba(100, 116, 139, 0.6)",
  number: "rgba(190, 220, 80, 0.55)",
  expression: "rgba(244, 114, 182, 0.6)",
  other: "rgba(148, 163, 184, 0.55)",
};

type GlossState = {
  word: string;
  gloss: string;
  type: VocabTypeKey;
  register: VocabRegisterKey | null;
  sentence?: string;
};

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

export type TapGlossLayerProps = {
  glosses: Record<string, TapGloss>;
  story?: { slug: string; title: string; language?: string | null };
};

function contextSentence(node: HTMLElement | null, word: string): string | undefined {
  const raw = node?.textContent?.replace(/\s+/g, " ").trim();
  if (!raw) return undefined;
  const sentences = raw.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const best = sentences.find((s) => s.toLowerCase().includes(word.toLowerCase())) ?? sentences[0];
  if (!best) return undefined;
  return best.length > 160 ? `${best.slice(0, 159).trimEnd()}…` : best;
}

// Token de lookup desde el texto visible del span: minúsculas y sin
// puntuación pegada ("Neukölln." -> "neukölln").
function tokenFromText(text: string): string {
  const m = text.toLowerCase().match(/[a-zäöüß]+(?:-[a-zäöüß]+)*/u);
  return m ? m[0] : "";
}

export default function TapGlossLayer({ glosses, story }: TapGlossLayerProps) {
  const [selected, setSelected] = React.useState<GlossState | null>(null);
  const [isFav, setIsFav] = React.useState(false);
  const { user, isLoaded } = useUser();
  const favsRef = React.useRef<FavoriteItem[]>([]);
  // Posicionamiento IDÉNTICO a VocabPanel (mismo default y misma medición
  // del dock). Mantener en sync con VocabPanel.tsx.
  const [dockBottom, setDockBottom] = React.useState<string>(
    "max(150px, calc(140px + env(safe-area-inset-bottom) + 12px))"
  );

  React.useEffect(() => {
    const measure = () => {
      const dock = document.getElementById("story-player-dock");
      const h = dock?.getBoundingClientRect().height ?? 0;
      if (h > 0) setDockBottom(`calc(${Math.ceil(h)}px + 12px + env(safe-area-inset-bottom))`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [selected]);

  const cacheKey = `dp_favorites_${user?.id ?? "guest"}`;
  const persistFavs = React.useCallback(
    (items: FavoriteItem[]) => {
      favsRef.current = items;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(items));
        localStorage.setItem("favorites", JSON.stringify(items));
      } catch {
        // ignore storage errors
      }
      window.dispatchEvent(new CustomEvent("favorites-updated"));
    },
    [cacheKey]
  );

  React.useEffect(() => {
    if (!isLoaded) return;
    const readCache = (): FavoriteItem[] => {
      try {
        const raw = localStorage.getItem(cacheKey);
        return raw ? (JSON.parse(raw) as FavoriteItem[]) : [];
      } catch {
        return [];
      }
    };
    const load = async () => {
      if (user) {
        try {
          const res = await fetch("/api/favorites", { cache: "no-store" });
          if (res.ok) {
            favsRef.current = (await res.json()) as FavoriteItem[];
            return;
          }
        } catch {
          // fall through to cache
        }
      }
      favsRef.current = readCache();
    };
    void load();
  }, [user, isLoaded, cacheKey]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(".vocab-word")) {
        setSelected(null);
        return;
      }
      if (target.closest("#tap-gloss-bubble")) return;
      // Dos fuentes de palabra tapeada: spans .tap-word (StoryContent) y
      // spans de karaoke [data-word-index] (HighlightedStoryContent).
      const el = target.closest(".tap-word, span[data-word-index]") as HTMLElement | null;
      if (!el) {
        setSelected(null);
        return;
      }
      const token = el.dataset.token ?? tokenFromText(el.textContent ?? "");
      const entry = token ? glosses[token] : undefined;
      if (!entry) {
        setSelected(null);
        return;
      }
      const word = (el.textContent ?? token).replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
      setSelected({
        word,
        gloss: entry.g,
        type: normalizeVocabType(entry.t, { word, definition: entry.g }) ?? "other",
        register: normalizeVocabRegister(entry.r),
        sentence: contextSentence(el.closest("p, blockquote"), word),
      });
      setIsFav(
        favsRef.current.some((f) => (f.word ?? "").trim().toLowerCase() === word.trim().toLowerCase())
      );
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [glosses]);

  const toggleFavorite = async () => {
    if (!selected) return;
    const prevFav = isFav;
    setIsFav(!prevFav);
    const item: FavoriteItem = {
      word: selected.word,
      translation: selected.gloss,
      wordType: selected.type === "other" ? null : selected.type,
      exampleSentence: selected.sentence,
      storySlug: story?.slug,
      storyTitle: story?.title,
      sourcePath: typeof window !== "undefined" ? window.location.pathname : undefined,
      language: story?.language ?? undefined,
    };
    const optimistic = prevFav
      ? favsRef.current.filter((f) => f.word !== selected.word)
      : [...favsRef.current, item];
    persistFavs(optimistic);
    if (user) {
      try {
        const res = await fetch("/api/favorites", {
          method: prevFav ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(prevFav ? { word: selected.word } : item),
        });
        if (!res.ok) throw new Error("Network error");
      } catch (err) {
        console.error("Error updating favorites:", err);
        // Keep optimistic local state so the action feels responsive offline.
      }
    }
  };

  if (!selected) return null;

  return (
    <div
      id="tap-gloss-bubble"
      className="fixed z-[70] vocab-overlay-wrap"
      onClick={(e) => e.stopPropagation()}
      style={{
        bottom: dockBottom,
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 36px)",
        maxWidth: 448,
        background: "var(--surface)",
        border: "1px dashed var(--card-border)",
        borderRadius: 20,
        padding: "12px 18px",
        boxShadow: "var(--shadow-card, 0 8px 14px rgba(0,0,0,0.22))",
      }}
      aria-label="qa-reader-tap-gloss-bubble"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          <span
            className="truncate text-[var(--foreground)]"
            style={{ fontSize: 18, fontWeight: 700 }}
          >
            {selected.word}
          </span>
          <span className="flex items-center gap-1.5" style={{ marginTop: 3 }}>
            <span
              className="inline-flex items-center gap-1"
              style={{
                backgroundColor: "rgba(148, 163, 184, 0.28)",
                color: "var(--foreground)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: 999,
                opacity: 0.85,
              }}
            >
              <Search size={10} strokeWidth={2.6} />
              Quick lookup
            </span>
            {selected.type !== "other" ? (
              <span
                style={{
                  backgroundColor: VOCAB_TYPE_BG[selected.type],
                  color: "#ffffff",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                {getVocabTypeLabel(selected.type)}
              </span>
            ) : null}
            {selected.register ? (
              <span
                style={{
                  border: "1px solid rgba(248, 193, 92, 0.85)",
                  color: "#f8c15c",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "1px 8px",
                  borderRadius: 999,
                }}
              >
                {getVocabRegisterLabel(selected.register)}
              </span>
            ) : null}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelected(null);
          }}
          aria-label="Close"
          className="shrink-0 grid place-items-center cursor-pointer"
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            backgroundColor: "var(--chip-bg)",
            color: "var(--foreground)",
            border: "1px solid var(--chip-border)",
          }}
        >
          <X size={14} strokeWidth={2.6} style={{ pointerEvents: "none" }} />
        </button>
      </div>
      <p
        className="mt-1.5 text-[var(--foreground)]"
        style={{ fontSize: 15, lineHeight: "22px", opacity: 0.9 }}
      >
        {selected.gloss}
      </p>
      <div className="mt-3 flex">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
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
                  fontSize: 13,
                  padding: "8px 14px",
                  borderRadius: 999,
                  boxShadow: "0 4px 12px rgba(248, 193, 92, 0.45)",
                }
              : {
                  backgroundColor: "var(--chip-bg)",
                  border: "1px solid var(--card-border)",
                  color: "var(--foreground)",
                  fontWeight: 700,
                  fontSize: 13,
                  padding: "8px 14px",
                  borderRadius: 999,
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.18)",
                }
          }
        >
          <Heart size={14} strokeWidth={2.4} fill={isFav ? "currentColor" : "none"} />
          {isFav ? "Saved" : "Save word"}
        </button>
      </div>
    </div>
  );
}
