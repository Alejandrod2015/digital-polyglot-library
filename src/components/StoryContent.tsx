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

const DIALOGUE_REGEX =
  /(„[\s\S]*?[“”]|[“”][\s\S]*?»|"[\s\S]*?")/gu;

function renderWithDialogues(
  paragraph: string,
  renderWord: (t: string) => React.ReactNode
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
          {renderWord(seg)}
        </span>
      );
    }
    return <span key={idx}>{renderWord(seg)}</span>;
  });
}

export default function StoryContent({
  text,
  sentencesPerParagraph = 3,
  className,
  onParagraphSelect,
  renderWord = (t) => t,
}: StoryContentProps) {
  const hasHtml = React.useMemo(
    () => /<\s*span[^>]*class=["']vocab-word["']/.test(text),
    [text]
  );

  const cleanedText = React.useMemo(() => stripHtml(text), [text]);
  const sentences = React.useMemo(
    () => splitSentences(cleanedText),
    [cleanedText]
  );
  const paragraphs = React.useMemo(
    () =>
      chunk(sentences, Math.max(1, Math.min(6, sentencesPerParagraph))).map((p) =>
        p.join(" ")
      ),
    [sentences, sentencesPerParagraph]
  );

  const containerRef = React.useRef<HTMLDivElement>(null);

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

      const rect = el.getBoundingClientRect();
      const offsetTop = rect.top + (scrollTarget.scrollTop || 0);
      const maxScroll =
        el.scrollHeight - (scrollTarget.clientHeight - BOTTOM_MARGIN);

      const base = Math.max(0, offsetTop - TITLE_MARGIN);
      const target = base + ratio * maxScroll;

      scrollTarget.scrollTo({
        top: target,
        behavior: "smooth",
      });
    };

    window.addEventListener("audio-progress", handleAudioProgress);
    return () =>
      window.removeEventListener("audio-progress", handleAudioProgress);
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
              <p key={i}>{renderWithDialogues(para, renderWord)}</p>
            )),
          })}
    />
  );
}
