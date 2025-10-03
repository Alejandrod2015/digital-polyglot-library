// src/components/StoryContent.tsx
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

// 🔑 Nueva función: elimina etiquetas HTML
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
  /(„[\s\S]*?[“”]|[“”][\s\S]*?[“”]|«[\s\S]*?»|"[\s\S]*?")/gu;

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
  // 👉 usamos stripHtml aquí
  const cleanText = React.useMemo(() => stripHtml(text), [text]);

  const sentences = React.useMemo(() => splitSentences(cleanText), [cleanText]);
  const paragraphs = React.useMemo(
    () =>
      chunk(
        sentences,
        Math.max(1, Math.min(6, sentencesPerParagraph))
      ).map((p) => p.join(" ")),
    [sentences, sentencesPerParagraph]
  );

  return (
    <div
      className={cx(
        "mx-auto max-w-[70ch] text-base sm:text-lg leading-7 sm:leading-8 tracking-[0.005em]",
        "text-slate-700 dark:text-slate-300",
        "space-y-5 sm:space-y-6",
        className
      )}
    >
      {paragraphs.map((para, i) => (
        <p
          key={i}
          onMouseUp={onParagraphSelect}
          className={cx(
            "select-text antialiased",
            "first:first-letter:float-left first:first-letter:mr-3",
            "first:first-letter:text-5xl first:first-letter:leading-[0.85] first:first-letter:font-semibold",
            "first:first-letter:text-sky-700 dark:first:first-letter:text-sky-400"
          )}
        >
          {renderWithDialogues(para, renderWord)}
        </p>
      ))}
    </div>
  );
}
