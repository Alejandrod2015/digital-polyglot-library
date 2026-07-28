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
  | {
      kind: "phrase";
      startIndex: number;
      endIndex: number; // exclusivo
      text: string;
      vocabKey: string | null;
    }
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

// Entrada de vocabulario más larga que empieza en el token `start`, en tokens.
// El lookup por token no puede casar NUNCA una entrada de varias palabras
// ("se lleva a cabo", "patio trasero", "no manches"), porque solo ve una
// palabra a la vez: esas entradas desaparecían en silencio. Aquí unimos
// tokens consecutivos con espacios y probamos contra el mismo lookup (que ya
// registra la superficie completa como clave), de más largo a más corto para
// que gane la frase entera y no un prefijo. Mismo enfoque que el lector móvil
// (apps/mobile/src/mobile/ReaderScreen.tsx: matchVocabPhrase).
function matchVocabPhrase(
  lookup: Map<string, string>,
  words: StoryWordToken[],
  start: number,
  endExclusive: number,
  maxTokens: number
): { canonical: string; spanEnd: number } | null {
  const cap = Math.min(endExclusive, start + maxTokens);
  for (let end = cap; end >= start + 2; end -= 1) {
    const joined = words
      .slice(start, end)
      .map((w) => w.text)
      .join(" ")
      .toLowerCase();
    const hit = lookup.get(joined);
    if (hit) return { canonical: hit, spanEnd: end };
  }
  return null;
}

// Cuántos tokens tiene la clave multi-palabra más larga, para saber hasta
// dónde mirar hacia delante. Sin claves multi-palabra devuelve 1 y el
// emparejado de frases queda en nada.
function maxPhraseTokenSpan(lookup: Map<string, string>): number {
  let max = 1;
  for (const key of lookup.keys()) {
    if (!key.includes(" ")) continue;
    const n = key.split(/\s+/).length;
    if (n > max) max = n;
  }
  return max;
}

function buildBlocks(
  payload: AudioWordTimingsPayload,
  vocabLookup: Map<string, string>
): RenderBlock[] {
  const text = payload.storyPlainText;
  const words = payload.words;

  const maxPhrase = maxPhraseTokenSpan(vocabLookup);
  const blocks: RenderBlock[] = [];
  let cursor = 0;
  let wordCursor = 0;
  // Highlight each vocab word only on its FIRST occurrence in the story (same
  // rule as StoryContent's `seenInStory` set). Without this the karaoke reader
  // re-pilled repeats; e.g. "mija" appearing twice in la-fonda got two pills.
  // The active-word karaoke highlight (by index) is unaffected; this only gates
  // the vocab pill class.
  const seenVocab = new Set<string>();

  // Split on EVERY newline, not just blank-line boundaries. Multi-voice
  // dialogue stories ("Speaker: line" turns separated by single \n) must
  // render one paragraph per turn; and, critically, each chunk must remain a
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
      // Frases primero: si la entrada de vocabulario abarca varios tokens, se
      // pinta como UNA píldora sobre el tramo entero, con su texto verbatim
      // (espacios y puntuación interna incluidos).
      const lastWordInChunk = (() => {
        let n = wordCursor;
        while (n < words.length && words[n].charEnd <= chunkEnd) n += 1;
        return n;
      })();
      const phrase =
        maxPhrase > 1
          ? matchVocabPhrase(vocabLookup, words, wordCursor, lastWordInChunk, maxPhrase)
          : null;
      if (phrase) {
        const first = words[wordCursor];
        const last = words[phrase.spanEnd - 1];
        const canon = phrase.canonical.toLowerCase();
        const repeat = seenVocab.has(canon);
        if (!repeat) seenVocab.add(canon);
        pieces.push({
          kind: "phrase",
          startIndex: wordCursor,
          endIndex: phrase.spanEnd,
          text: text.slice(first.charStart, last.charEnd),
          vocabKey: repeat ? null : phrase.canonical,
        });
        cursor = last.charEnd;
        wordCursor = phrase.spanEnd;
        continue;
      }
      const lower = w.text.toLowerCase();
      let vocabKey = vocabLookup.get(lower) ?? null;
      if (vocabKey) {
        const canon = vocabKey.toLowerCase();
        if (seenVocab.has(canon)) vocabKey = null; // repeat → no pill
        else seenVocab.add(canon);
      }
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
  // Usa resolveVocabType arriba; morfología fuerte tiene prioridad sobre
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
              // gap, not a timed word; the audio never speaks the label).
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
            if (piece.kind === "phrase") {
              // El karaoke va por índice de palabra; la frase se ilumina
              // mientras el cursor esté DENTRO de su tramo.
              const activeHere =
                activeWordIndex !== null &&
                activeWordIndex >= piece.startIndex &&
                activeWordIndex < piece.endIndex;
              return (
                <span
                  key={`ph-${piece.startIndex}`}
                  ref={(el) => {
                    // Registramos el mismo nodo para cada índice del tramo, si
                    // no el auto-scroll pierde el ancla dentro de la frase.
                    if (!onWordRef) return;
                    for (let i = piece.startIndex; i < piece.endIndex; i += 1) onWordRef(i, el);
                  }}
                  data-word-index={piece.startIndex}
                  {...(piece.vocabKey ? { "data-word": piece.vocabKey } : {})}
                  {...(piece.vocabKey
                    ? {
                        "data-vocab-type":
                          vocabTypeByLower.get(piece.vocabKey.toLowerCase()) ?? "other",
                      }
                    : {})}
                  className={[
                    "transition-colors duration-150 rounded",
                    activeHere ? "bg-[#f8c15c] text-black font-medium" : "",
                    piece.vocabKey ? "vocab-word" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {piece.text}
                </span>
              );
            }
            const isActive = activeWordIndex === piece.index;
            // Active highlight is background-only, no padding change. Adding
            // padding here would compound with .vocab-word's existing
            // `padding: 0 0.15em` from globals.css and visibly shift the line
            // whenever an active word overlapped a vocab word.
            //
            // Active uses warm amber (#f8c15c); the same hue the legacy
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
