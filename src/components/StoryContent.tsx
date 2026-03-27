// /src/components/StoryContent.tsx
// ✅ Versión adaptativa: mantiene autoscroll funcional tras el cambio de layout

"use client";

import * as React from "react";

export type StoryContentProps = {
  text: string;
  sentencesPerParagraph?: number;
  className?: string;
  onParagraphSelect?: (e: React.MouseEvent<HTMLParagraphElement>) => void;
  renderWord?: (t: string) => React.ReactNode;
  vocab?: Array<{ word: string; surface?: string }>;
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
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
  vocab: Array<{ word: string; surface?: string }>,
  renderWord: (t: string) => React.ReactNode
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
  const alreadyHighlighted = new Set<string>();
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
    if (alreadyHighlighted.has(canonicalKey)) {
      nodes.push(<React.Fragment key={`txt-${key++}`}>{renderWord(matchedText)}</React.Fragment>);
    } else {
      alreadyHighlighted.add(canonicalKey);
      nodes.push(
        <span key={`voc-${key++}`} className="vocab-word" data-word={canonical}>
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
  const sentences = React.useMemo(() => (hasHtml ? [] : splitSentences(cleanedText)), [hasHtml, cleanedText]);
  const paragraphs = React.useMemo(() => {
    if (hasHtml) return [];
    return chunk(sentences, Math.max(1, Math.min(6, sentencesPerParagraph))).map((p) => p.join(" "));
  }, [hasHtml, sentences, sentencesPerParagraph]);

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
            children: htmlBlocks.map((block, i) =>
              block.tag === "blockquote" ? (
                <blockquote key={`bq-${i}`}>
                  <p>{highlightVocabulary(block.text, safeVocab, renderWord)}</p>
                </blockquote>
              ) : (
                <p key={`p-${i}`}>{highlightVocabulary(block.text, safeVocab, renderWord)}</p>
              )
            ),
          }
        : {
            children: paragraphs.map((para, i) => (
              <p key={i}>{highlightVocabulary(para, safeVocab, renderWord)}</p>
            )),
          })}
    />
  );
}
