"use client";

import React from "react";
import { X } from "lucide-react";
import StoryContent from "@/components/StoryContent";

// Piloto "tap any word" (2026-07-06): envuelve el StoryContent existente.
// Cada palabra con gloss precomputado se renderiza como span.tap-word; al
// tocarla aparece una burbuja en el MISMO lugar que la del vocab curado
// (arriba del player dock, centrada), pero visualmente distinta: etiqueta
// gris "Dictionary", sin badge de tipo y sin Save. Feedback del usuario
// 2026-07-06: el tooltip flotante junto a la palabra tapaba el texto.
// Las pills curadas (.vocab-word) tienen prioridad: su click sigue yendo
// al VocabPanel.
type TapGlossReaderProps = {
  text: string;
  vocab: Array<{ word: string; surface?: string; definition: string; type?: string }>;
  glosses: Record<string, string>;
};

type GlossState = {
  word: string;
  gloss: string;
};

const WORD_SPLIT = /([A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*)/u;

export default function TapGlossReader({ text, vocab, glosses }: TapGlossReaderProps) {
  const [selected, setSelected] = React.useState<GlossState | null>(null);
  // Misma lógica de posicionamiento que VocabPanel: la burbuja vive justo
  // arriba del player dock; si no hay dock (historias sin audio aún), queda
  // a 24px del borde inferior.
  const [dockBottom, setDockBottom] = React.useState<string>(
    "calc(24px + env(safe-area-inset-bottom))"
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
        setSelected(null);
        return;
      }
      // Clicks dentro de la burbuja no la cierran.
      if (target.closest("#tap-gloss-bubble")) return;
      const el = target.closest(".tap-word") as HTMLElement | null;
      if (!el) {
        setSelected(null);
        return;
      }
      const token = el.dataset.token ?? "";
      const gloss = glosses[token];
      if (!gloss) return;
      setSelected({ word: el.textContent ?? token, gloss });
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [glosses]);

  return (
    <div className="relative">
      <StoryContent
        text={text}
        sentencesPerParagraph={3}
        vocab={vocab}
        renderWord={renderWord}
      />
      {selected ? (
        <div
          id="tap-gloss-bubble"
          className="fixed z-[70]"
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
              <span
                className="self-start"
                style={{
                  backgroundColor: "rgba(148, 163, 184, 0.28)",
                  color: "var(--foreground)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: 999,
                  marginTop: 3,
                  opacity: 0.85,
                }}
              >
                Dictionary
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
        </div>
      ) : null}
    </div>
  );
}
