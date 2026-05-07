"use client";

import * as React from "react";

import type { AudioWordTimingsPayload, StoryWordToken } from "@/lib/audioWordTimings";

type VocabItem = { word: string; surface?: string };

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

  const paragraphChunks = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.replace(/\n/g, " ").trim())
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
