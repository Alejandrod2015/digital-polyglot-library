"use client";

import * as React from "react";

// Apuntamos al archivo de TIPOS puro (sin prisma). `import type` se
// borra en compile y Webpack no carga el módulo runtime, pero esto
// blinda contra futuras imports runtime: si alguien convierte este
// a `import { ... }`, no peta el client bundle con
// "PrismaClient is unable to run in this browser environment".
import type { AudioWordTimingsPayload, StoryWordToken } from "@/lib/audioWordTimingsTypes";
import { normalizeVocabType } from "@/lib/vocabTypes";

type VocabItem = { word: string; surface?: string; type?: string | null; definition?: string };

// Morphology-first vocab type resolution (mismo que StoryContent).
// La inferencia compartida en @/lib/vocabTypes cae a "noun" demasiado
// agresivamente cuando la definición tiene formato narrativo. Acá
// priorizamos morfología inequívoca (verb infinitive -ar/-er/-ir,
// -mente adverb, multi-word expression) y sólo después miramos el
// type explícito del data.
function resolveVocabType(item: VocabItem): string {
  const word = (item.word ?? item.surface ?? "").trim().toLowerCase();
  const def = (item.definition ?? "").trim().toLowerCase();

  if (word.includes(" ") || word.includes("-")) return "expression";
  if (word.endsWith("mente") || word.endsWith("ly")) return "adverb";

  const ADJ_SUF = ["oso", "osa", "ivo", "iva", "able", "ible", "iento", "ienta"];
  if (ADJ_SUF.some((s) => word.endsWith(s))) return "adjective";

  const NOUN_SUF = ["ción", "sión", "dad", "tad", "tud", "aje", "anza", "encia", "ancia", "miento", "ismo", "ista", "ería", "azo", "ote"];
  if (NOUN_SUF.some((s) => word.endsWith(s))) return "noun";

  if (word.length >= 4 && /(?:ar|er|ir)$/.test(word)) return "verb";

  if (item.type) {
    const explicit = normalizeVocabType(item.type);
    if (explicit) return explicit;
  }

  if (def.startsWith("to ")) return "verb";

  return "other";
}

type HighlightedStoryContentProps = {
  payload: AudioWordTimingsPayload;
  vocab?: VocabItem[];
  className?: string;
  activeWordIndex: number | null;
  onWordRef?: (index: number, el: HTMLSpanElement | null) => void;
};

type RenderPiece =
  | { kind: "word"; index: number; token: StoryWordToken; vocabKey: string | null }
  | { kind: "gap"; text: string };

type RenderBlock = {
  kind: "p";
  pieces: RenderPiece[];
};

function buildVocabLookup(vocab: VocabItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of vocab) {
    const surface =
      typeof item.surface === "string" && item.surface.trim() ? item.surface.trim() : "";
    const word = typeof item.word === "string" ? item.word.trim() : "";
    const canonical = word || surface;
    if (!canonical) continue;
    if (surface) map.set(surface.toLowerCase(), canonical);
    if (word) map.set(word.toLowerCase(), canonical);
  }
  return map;
}

function buildBlocks(
  payload: AudioWordTimingsPayload,
  vocabLookup: Map<string, string>
): RenderBlock[] {
  const text = payload.storyPlainText;
  const words = payload.words;

  const blocks: RenderBlock[] = [];
  let cursor = 0;
  let wordCursor = 0;

  // Split on EVERY newline, not just blank-line boundaries. Multi-voice
  // dialogue stories ("Speaker: line" turns separated by single \n) must
  // render one paragraph per turn — and, critically, each chunk must remain a
  // VERBATIM substring of `text` so `text.indexOf(chunk)` returns the real
  // char offset. The old `\n{2,}` + `\n`→space collapse merged every dialogue
  // turn into one paragraph AND broke the offset lookup (the space-collapsed
  // chunk no longer existed in `text`, so indexOf returned -1 and the word
  // timings mapped to the wrong characters → karaoke drift vs the audio).
  const paragraphChunks = text
    .split(/\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  let absoluteOffset = 0;

  for (const chunk of paragraphChunks) {
    const chunkStart = text.indexOf(chunk, absoluteOffset);
    const chunkEnd = chunkStart + chunk.length;
    absoluteOffset = chunkEnd;

    const pieces: RenderPiece[] = [];
    cursor = chunkStart;

    while (wordCursor < words.length && words[wordCursor].charEnd <= chunkEnd) {
      const w = words[wordCursor];
      if (w.charStart < chunkStart) {
        wordCursor += 1;
        continue;
      }
      if (cursor < w.charStart) {
        pieces.push({ kind: "gap", text: text.slice(cursor, w.charStart) });
      }
      const lower = w.text.toLowerCase();
      const vocabKey = vocabLookup.get(lower) ?? null;
      pieces.push({ kind: "word", index: wordCursor, token: w, vocabKey });
      cursor = w.charEnd;
      wordCursor += 1;
    }
    if (cursor < chunkEnd) {
      const tail = text.slice(cursor, chunkEnd);
      if (tail.trim()) pieces.push({ kind: "gap", text: tail });
    }
    if (pieces.length > 0) blocks.push({ kind: "p", pieces });
  }

  return blocks;
}

export default function HighlightedStoryContent({
  payload,
  vocab = [],
  className,
  activeWordIndex,
  onWordRef,
}: HighlightedStoryContentProps) {
  const vocabLookup = React.useMemo(() => buildVocabLookup(vocab), [vocab]);
  // Vocab type por palabra para colorear cada pill según categoría
  // (verb=coral, noun=sky, adjective=emerald, adverb=purple, expression=pink).
  // Usa resolveVocabType arriba — morfología fuerte tiene prioridad sobre
  // la definición narrativa (que el viejo helper interpretaba mal).
  const vocabTypeByLower = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const item of vocab) {
      const surface = item.surface?.trim().toLowerCase();
      const word = item.word?.trim().toLowerCase();
      if (!word && !surface) continue;
      const resolved = resolveVocabType(item);
      if (word) map.set(word, resolved);
      if (surface && surface !== word) map.set(surface, resolved);
    }
    return map;
  }, [vocab]);
  const blocks = React.useMemo(
    () => buildBlocks(payload, vocabLookup),
    [payload, vocabLookup]
  );

  return (
    <div
      className={
        className ??
        "mx-auto max-w-[65ch] text-xl leading-relaxed text-[var(--foreground)] space-y-6"
      }
    >
      {blocks.map((block, blockIndex) => (
        <p key={`p-${blockIndex}`}>
          {block.pieces.map((piece, pieceIndex) => {
            if (piece.kind === "gap") {
              // Bold the leading "Speaker:" label on dialogue turns (it is a
              // gap, not a timed word — the audio never speaks the label).
              const labelMatch =
                pieceIndex === 0
                  ? piece.text.match(
                      /^(\s*[\p{Lu}][\p{L}\p{M}.'-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'-]*){0,3}:)(\s*)$/u
                    )
                  : null;
              if (labelMatch) {
                return (
                  <React.Fragment key={`g-${blockIndex}-${pieceIndex}`}>
                    <strong>{labelMatch[1]}</strong>
                    {labelMatch[2]}
                  </React.Fragment>
                );
              }
              return (
                <React.Fragment key={`g-${blockIndex}-${pieceIndex}`}>{piece.text}</React.Fragment>
              );
            }
            const isActive = activeWordIndex === piece.index;
            // Active highlight is background-only, no padding change. Adding
            // padding here would compound with .vocab-word's existing
            // `padding: 0 0.15em` from globals.css and visibly shift the line
            // whenever an active word overlapped a vocab word.
            //
            // Active uses warm amber (#f8c15c) — the same hue the legacy
            // reader used for vocab; vocab moved to sky-blue in globals.css
            // so the two highlight kinds read as distinctly different marks.
            const baseClass = "transition-colors duration-150 rounded";
            const activeClass = isActive ? "bg-[#f8c15c] text-black font-medium" : "";
            const vocabClass = piece.vocabKey ? "vocab-word" : "";
            return (
              <span
                key={`w-${piece.index}`}
                ref={(el) => {
                  if (onWordRef) onWordRef(piece.index, el);
                }}
                data-word-index={piece.index}
                {...(piece.vocabKey ? { "data-word": piece.vocabKey } : {})}
                {...(piece.vocabKey
                  ? {
                      "data-vocab-type":
                        vocabTypeByLower.get(piece.vocabKey.toLowerCase()) ?? "other",
                    }
                  : {})}
                className={[baseClass, activeClass, vocabClass].filter(Boolean).join(" ")}
              >
                {piece.token.text}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
