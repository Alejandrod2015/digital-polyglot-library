// /src/components/StoryContent.tsx
// ✅ Versión adaptativa: mantiene autoscroll funcional tras el cambio de layout

"use client";

import * as React from "react";
import { normalizeVocabType } from "@/lib/vocabTypes";

/**
 * Stricter type resolution for vocab pills: priorizar morfología
 * inequívoca antes que la inferencia genérica que cae a "noun"
 * por default. Si el item trae un `type` explícito en la data, lo
 * respetamos como autoridad final.
 *
 * Orden:
 *   1. Multi-palabra → expression
 *   2. -mente / -ly → adverb
 *   3. -ar / -er / -ir con ≥4 chars → verb
 *   4. Sufijos adjetivos españoles (oso/iva/able/ible/iento) → adjective
 *   5. Sufijos sustantivos españoles (ción/dad/aje/anza/miento/ista/ería/azo/ote) → noun
 *   6. Si data trae `type` explícito, usarlo
 *   7. Si la definición arranca con "to " → verb (señal fuerte)
 *   8. Fallback → "other" (slate gris, no más mentira de noun)
 */
function resolveVocabType(item: {
  word?: string;
  surface?: string;
  type?: string | null;
  definition?: string;
}): string {
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

export type StoryContentProps = {
  text: string;
  sentencesPerParagraph?: number;
  className?: string;
  onParagraphSelect?: (e: React.MouseEvent<HTMLParagraphElement>) => void;
  renderWord?: (t: string) => React.ReactNode;
  // El campo `type` lo usamos para colorear el resaltado por categoría
  // gramatical (verb/noun/adjective/adverb/expression). Mismo catálogo
  // que la app de iPhone. `definition` se usa sólo para que
  // normalizeVocabType pueda inferir el tipo cuando falta o es raro.
  vocab?: Array<{ word: string; surface?: string; type?: string | null; definition?: string }>;
};

const MAX_HIGHLIGHT_WORDS = 30;
const MAX_HIGHLIGHT_WORD_LENGTH = 48;
const MAX_HIGHLIGHT_WORD_TOKENS = 4;
const MAX_REGEX_SOURCE_LENGTH = 1400;
const MAX_TEXT_LENGTH_FOR_HIGHLIGHT = 25000;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function stripHtml(raw: string): string {
  // Strip tags only. Whitespace normalization (collapsing spaces/tabs,
  // preserving \n, capping \n{3,}→\n\n) is the job of
  // sanitizePlainStoryText, which always wraps this call. The old
  // implementation collapsed \s+ → " ", which silently destroyed every
  // newline in plain-text multi-voice stories — making
  // detectDialogueBlocks receive one giant single-line blob and fall
  // back to prose rendering (dialogue + narrator crushed together).
  return raw.replace(/<[^>]+>/g, " ");
}

function stripLegacyVocabSpans(raw: string): string {
  return raw.replace(
    /<span\s+[^>]*class=["']vocab-word["'][^>]*>(.*?)<\/span>/giu,
    (_match, inner: string) => inner
  );
}

function sanitizePlainStoryText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?])(?:\s*[.!?]){1,}/g, "$1")
    .trim();
}

function splitSentences(raw: string): string[] {
  const text = raw.replace(/\s*\n+\s*/g, " ").trim();
  if (!text) return [];
  const parts = text.split(/(?<=[.!?…\u203D\u2047\u2049]["»”’]?)(?:\s+|$)/u);
  const clean = parts
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => /[\p{L}\p{N}]/u.test(s));

  const merged: string[] = [];
  for (const segment of clean) {
    const shouldAttachToPrev =
      merged.length > 0 && /^[\s,"'“”„«»)\]]*[\p{Ll}]/u.test(segment);
    if (shouldAttachToPrev) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${segment}`;
      continue;
    }
    merged.push(segment);
  }
  return merged;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractLegacyDataWords(html: string): string[] {
  const regex = /data-word=["']([^"']+)["']/giu;
  const out: string[] = [];
  let match: RegExpExecArray | null = regex.exec(html);
  while (match) {
    const word = (match[1] ?? "").trim();
    if (word) out.push(word);
    match = regex.exec(html);
  }
  return Array.from(new Set(out));
}

type HtmlBlock = {
  tag: "p" | "blockquote";
  text: string;
};

function extractHtmlBlocks(html: string): HtmlBlock[] {
  const cleanHtml = stripLegacyVocabSpans(html);
  const blockRegex = /<(blockquote|p)\b[^>]*>([\s\S]*?)<\/\1>/giu;
  const blocks: HtmlBlock[] = [];
  let match: RegExpExecArray | null = blockRegex.exec(cleanHtml);

  while (match) {
    const tag = match[1]?.toLowerCase() === "blockquote" ? "blockquote" : "p";
    const text = sanitizePlainStoryText(stripHtml(match[2] ?? ""));
    if (text) blocks.push({ tag, text });
    match = blockRegex.exec(cleanHtml);
  }

  if (blocks.length > 0) return blocks;

  const fallback = sanitizePlainStoryText(stripHtml(cleanHtml));
  if (!fallback) return [];
  return splitSentences(fallback).map((text) => ({ tag: "p", text }));
}

// Detect a dialogue story formatted as "Speaker: line" turns separated by
// newlines (the multi-voice template used by Café in Kreuzberg, Beim Bäcker,
// etc.). Returns one block per line so we can render the speaker label in bold
// and break paragraphs at every speaker change. Returns null when the text
// doesn't look like a dialogue (e.g. flowing prose).
type DialogueRenderBlock = { speaker: string | null; text: string };

// Unicode property classes so the matcher accepts speaker names with
// ANY accented Latin character (Spanish "Don Hernán", Italian "Niccolò",
// French "Hélène", Portuguese "João"), not just the ASCII + German set.
// The old hardcoded class silently failed every line whose speaker had
// an accent — collapsing those lines into the paragraph above because
// the 40% dialogue-line threshold below was never reached.
const DIALOGUE_LABEL_REGEX =
  /^([\p{Lu}][\p{L}\p{M}.'-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'-]*){0,3}):\s+(.*\S)\s*$/u;

function detectDialogueBlocks(rawText: string): DialogueRenderBlock[] | null {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const blocks: DialogueRenderBlock[] = [];
  let dialogueLines = 0;
  for (const line of lines) {
    const match = line.match(DIALOGUE_LABEL_REGEX);
    if (match) {
      blocks.push({ speaker: match[1].trim(), text: match[2].trim() });
      dialogueLines += 1;
    } else {
      blocks.push({ speaker: null, text: line });
    }
  }
  if (dialogueLines / lines.length < 0.4) return null;
  return blocks;
}

function normalizeVocabForHighlight(vocab: Array<{ word: string; surface?: string }>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of vocab) {
    const raw =
      typeof item?.surface === "string" && item.surface.trim()
        ? item.surface.trim()
        : typeof item?.word === "string"
          ? item.word.trim()
          : "";
    if (!raw) continue;
    if (raw.length < 3 || raw.length > MAX_HIGHLIGHT_WORD_LENGTH) continue;
    if (/[<>[\]{}]/.test(raw)) continue;
    const tokenCount = raw.split(/\s+/).filter(Boolean).length;
    if (tokenCount > MAX_HIGHLIGHT_WORD_TOKENS) continue;

    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
    if (out.length >= MAX_HIGHLIGHT_WORDS) break;
  }

  return out;
}

function highlightVocabulary(
  text: string,
  vocab: Array<{ word: string; surface?: string; type?: string | null; definition?: string }>,
  renderWord: (t: string) => React.ReactNode,
  vocabTypeByLower?: Map<string, string>,
  // Compartido entre llamadas para que cada palabra del vocab sólo
  // se highlightee la PRIMERA vez en toda la historia. Si no se
  // pasa, cada bloque dedupea independiente (modo legacy). El bug:
  // historias multi-blockquote re-highlightean speaker labels
  // (e.g. "Guardabosques Julio:" 6 veces) porque cada llamada
  // arrancaba con Set vacío.
  alreadyHighlighted?: Set<string>
) {
  if (text.length > MAX_TEXT_LENGTH_FOR_HIGHLIGHT) return renderWord(text);

  const cleanWords = normalizeVocabForHighlight(vocab);

  if (cleanWords.length === 0) return renderWord(text);

  const uniqueWords = Array.from(new Set(cleanWords.map((w) => w.trim())));
  const canonicalByLower = new Map(uniqueWords.map((w) => [w.toLowerCase(), w] as const));
  const alternatives = [...uniqueWords]
    .sort((a, b) => b.length - a.length)
    .map((w) => escapeRegex(w));
  if (alternatives.length === 0) return renderWord(text);
  const regexSource = alternatives.join("|");
  if (regexSource.length > MAX_REGEX_SOURCE_LENGTH) return renderWord(text);

  let regex: RegExp;
  try {
    regex = new RegExp(
      `(^|[^\\p{L}\\p{N}_])(${regexSource})(?=$|[^\\p{L}\\p{N}_])`,
      "giu"
    );
  } catch {
    return renderWord(text);
  }

  const nodes: React.ReactNode[] = [];
  const seenWords = alreadyHighlighted ?? new Set<string>();
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null = regex.exec(text);

  while (match) {
    const leading = match[1] ?? "";
    const matchedText = match[2] ?? "";
    const start = match.index + leading.length;
    const end = start + matchedText.length;

    if (start > lastIndex) {
      const before = text.slice(lastIndex, start);
      if (before) nodes.push(<React.Fragment key={`txt-${key++}`}>{renderWord(before)}</React.Fragment>);
    }

    const canonical = canonicalByLower.get(matchedText.toLowerCase()) ?? matchedText;
    const canonicalKey = canonical.toLowerCase();
    const vocabType = vocabTypeByLower?.get(canonicalKey) ?? "other";
    if (seenWords.has(canonicalKey)) {
      nodes.push(<React.Fragment key={`txt-${key++}`}>{renderWord(matchedText)}</React.Fragment>);
    } else {
      seenWords.add(canonicalKey);
      nodes.push(
        <span
          key={`voc-${key++}`}
          className="vocab-word"
          data-word={canonical}
          data-vocab-type={vocabType}
        >
          {renderWord(matchedText)}
        </span>
      );
    }
    lastIndex = end;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex);
    if (tail) nodes.push(<React.Fragment key={`txt-${key++}`}>{renderWord(tail)}</React.Fragment>);
  }

  return nodes.length > 0 ? nodes : renderWord(text);
}

export default function StoryContent({
  text,
  sentencesPerParagraph = 3,
  className,
  onParagraphSelect,
  renderWord = (t) => t,
  vocab = [],
}: StoryContentProps) {
  const hasHtml = React.useMemo(
    () => /<[^>]+>/.test(text),
    [text]
  );
  const legacyWords = React.useMemo(() => (hasHtml ? extractLegacyDataWords(text) : []), [hasHtml, text]);
  const vocabSet = React.useMemo(
    () =>
      new Set(
        vocab
          .map((item) => item.word?.trim().toLowerCase())
          .filter((word): word is string => typeof word === "string" && word.length > 0)
      ),
    [vocab]
  );
  const safeVocab = React.useMemo(
    () => normalizeVocabForHighlight(vocab).map((word) => ({ word })),
    [vocab]
  );
  // Map word (lowercase) → vocab type. Usa resolveVocabType (definido
  // arriba) que prioriza morfología fuerte sobre la definición — así
  // verbos en -ar/-er/-ir no se confunden con sustantivos sólo porque
  // la definición empieza con "A " en lugar de "to ".
  const vocabTypeByLower = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const item of vocab) {
      const w = item.word?.trim().toLowerCase();
      if (!w) continue;
      const resolved = resolveVocabType(item);
      map.set(w, resolved);
      const surface = item.surface?.trim().toLowerCase();
      if (surface && surface !== w) map.set(surface, resolved);
    }
    return map;
  }, [vocab]);
  const htmlBlocks = React.useMemo(() => (hasHtml ? extractHtmlBlocks(text) : []), [hasHtml, text]);

  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!hasHtml || legacyWords.length === 0 || vocabSet.size === 0) return;
    const missing = legacyWords.filter((word) => !vocabSet.has(word.toLowerCase()));
    if (missing.length > 0) {
      console.warn(
        `[StoryContent] Found legacy data-word entries without vocab definition: ${missing.join(", ")}`
      );
    }
  }, [hasHtml, legacyWords, vocabSet]);

  const cleanedText = React.useMemo(
    () => (hasHtml ? "" : sanitizePlainStoryText(stripHtml(stripLegacyVocabSpans(text)))),
    [hasHtml, text]
  );
  // Multi-voice dialogue stories carry "Speaker: line" turns separated by
  // newlines. When detected, render each turn on its own paragraph with the
  // speaker label in bold so readers can follow the conversation visually.
  // Falls back to standard sentence chunking when the text isn't a dialogue.
  const dialogueBlocks = React.useMemo(
    () => (hasHtml ? null : detectDialogueBlocks(cleanedText)),
    [hasHtml, cleanedText]
  );
  const sentences = React.useMemo(
    () => (hasHtml || dialogueBlocks ? [] : splitSentences(cleanedText)),
    [hasHtml, dialogueBlocks, cleanedText]
  );
  const paragraphs = React.useMemo(() => {
    if (hasHtml || dialogueBlocks) return [];
    return chunk(sentences, Math.max(1, Math.min(6, sentencesPerParagraph))).map((p) => p.join(" "));
  }, [hasHtml, dialogueBlocks, sentences, sentencesPerParagraph]);

    const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollStartRef = React.useRef<number | null>(null);

  // ✅ Scroll sincronizado con progreso del audio (adaptativo: main o body)
  React.useEffect(() => {
    const TITLE_MARGIN = 150;
    const BOTTOM_MARGIN = 380;

    const handleAudioProgress = (e: Event) => {
      const custom = e as CustomEvent<number>;
      const ratio = Math.min(1, Math.max(0, custom.detail));
      const el = containerRef.current;
      if (!el) return;

      const mainEl = document.querySelector("main");
      const scrollTarget =
        mainEl && mainEl.scrollHeight > mainEl.clientHeight
          ? mainEl
          : document.scrollingElement || document.documentElement;

      const currentScrollTop = scrollTarget.scrollTop || 0;

      // Guardamos desde dónde empezamos a hacer autoscroll
      if (scrollStartRef.current === null) {
        scrollStartRef.current = currentScrollTop;
      }

      const rect = el.getBoundingClientRect();
      const offsetTop = rect.top + currentScrollTop;
      const maxScroll =
        el.scrollHeight - (scrollTarget.clientHeight - BOTTOM_MARGIN);

      const startScroll = scrollStartRef.current;
      const endBase = Math.max(0, offsetTop - TITLE_MARGIN);
      const endScroll = endBase + maxScroll;

      // Interpolamos entre posición inicial y final según el progreso del audio
      const target = startScroll + ratio * (endScroll - startScroll);

      scrollTarget.scrollTo({
        top: target,
        behavior: "smooth",
      });
    };

    window.addEventListener("audio-progress", handleAudioProgress);
    return () => {
      scrollStartRef.current = null;
      window.removeEventListener("audio-progress", handleAudioProgress);
    };
  }, []);


  return (
    <div
      ref={containerRef}
      className={cx(
        "mx-auto max-w-[65ch] text-xl leading-relaxed text-[var(--foreground)] space-y-6",
        "[&_p]:my-4 [&_blockquote]:my-4 [&_blockquote]:m-0 [&_blockquote]:pl-0 [&_blockquote]:border-0 [&_blockquote]:not-italic [&_blockquote]:text-[var(--foreground)]",
        "no-scrollbar scroll-smooth",
        className
      )}
      onMouseUp={onParagraphSelect}
      {...(hasHtml
        ? {
            children: (() => {
              // Set compartido entre TODOS los bloques de la historia,
              // así cada palabra del vocab se highlightea sólo en su
              // primera ocurrencia (incluso si los bloques son
              // blockquotes distintos para cada line de diálogo).
              const seenInStory = new Set<string>();
              return htmlBlocks.map((block, i) =>
                block.tag === "blockquote" ? (
                  <blockquote key={`bq-${i}`}>
                    <p>{highlightVocabulary(block.text, safeVocab, renderWord, vocabTypeByLower, seenInStory)}</p>
                  </blockquote>
                ) : (
                  <p key={`p-${i}`}>{highlightVocabulary(block.text, safeVocab, renderWord, vocabTypeByLower, seenInStory)}</p>
                )
              );
            })(),
          }
        : dialogueBlocks
          ? {
              children: (() => {
                const seenInStory = new Set<string>();
                return dialogueBlocks.map((block, i) =>
                  block.speaker ? (
                    <p key={`dlg-${i}`}>
                      <strong>{block.speaker}:</strong>{" "}
                      {highlightVocabulary(block.text, safeVocab, renderWord, vocabTypeByLower, seenInStory)}
                    </p>
                  ) : (
                    <p key={`nar-${i}`}>{highlightVocabulary(block.text, safeVocab, renderWord, vocabTypeByLower, seenInStory)}</p>
                  )
                );
              })(),
            }
          : {
              children: (() => {
                const seenInStory = new Set<string>();
                return paragraphs.map((para, i) => (
                  <p key={i}>{highlightVocabulary(para, safeVocab, renderWord, vocabTypeByLower, seenInStory)}</p>
                ));
              })(),
            })}
    />
  );
}
