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
  vocab?: Array<{ word: string }>;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function splitSentences(raw: string): string[] {
  const text = raw.replace(/\s*\n+\s*/g, " ").trim();
  if (!text) return [];
  const parts = text.split(
    /(?<=([.!?…]|\u203D|\u2047|\u2049)["»”’]?)(?:\s+|$)/u
  );
  return parts.map((s) => s.trim()).filter(Boolean);
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

function highlightVocabulary(
  text: string,
  vocab: Array<{ word: string }>,
  renderWord: (t: string) => React.ReactNode
) {
  const cleanWords = vocab
    .map((v) => v.word?.trim())
    .filter((w): w is string => typeof w === "string" && w.length >= 3)
    .slice(0, 40);

  if (cleanWords.length === 0) return renderWord(text);

  const uniqueWords = Array.from(new Set(cleanWords.map((w) => w.trim())));
  const canonicalByLower = new Map(uniqueWords.map((w) => [w.toLowerCase(), w] as const));
  const alternatives = [...uniqueWords]
    .sort((a, b) => b.length - a.length)
    .map((w) => escapeRegex(w));
  if (alternatives.length === 0) return renderWord(text);

  const regex = new RegExp(
    `(^|[^\\p{L}\\p{N}_])(${alternatives.join("|")})(?=$|[^\\p{L}\\p{N}_])`,
    "giu"
  );

  const nodes: React.ReactNode[] = [];
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
    nodes.push(
      <span key={`voc-${key++}`} className="vocab-word" data-word={canonical}>
        {renderWord(matchedText)}
      </span>
    );
    lastIndex = end;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex);
    if (tail) nodes.push(<React.Fragment key={`txt-${key++}`}>{renderWord(tail)}</React.Fragment>);
  }

  return nodes.length > 0 ? nodes : renderWord(text);
}

const DIALOGUE_REGEX =
  /(„[\s\S]*?[“”]|[“”][\s\S]*?»|"[\s\S]*?")/gu;

function renderWithDialogues(
  paragraph: string,
  renderWord: (t: string) => React.ReactNode,
  vocab: Array<{ word: string }>
) {
  const segments = paragraph.split(DIALOGUE_REGEX);
  return segments.map((seg, idx) => {
    const isDialogue = idx % 2 === 1;
    if (isDialogue) {
      return (
        <span
          key={idx}
          className="block my-3 pl-4 border-l-4 border-sky-500 bg-sky-500/10 rounded-r-lg italic"
        >
          {highlightVocabulary(seg, vocab, renderWord)}
        </span>
      );
    }
    return <span key={idx}>{highlightVocabulary(seg, vocab, renderWord)}</span>;
  });
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
    () => /<\s*span[^>]*class=["']vocab-word["']/.test(text),
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

  const cleanedText = React.useMemo(() => (hasHtml ? "" : stripHtml(text)), [hasHtml, text]);
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
        "mx-auto max-w-[65ch] text-xl leading-relaxed text-gray-200 space-y-6",
        "prose prose-invert prose-p:my-4 prose-blockquote:italic prose-blockquote:text-sky-400",
        "no-scrollbar scroll-smooth",
        className
      )}
      onMouseUp={onParagraphSelect}
      {...(hasHtml
        ? { dangerouslySetInnerHTML: { __html: text } }
        : {
            children: paragraphs.map((para, i) => (
              <p key={i}>{renderWithDialogues(para, renderWord, vocab)}</p>
            )),
          })}
    />
  );
}
