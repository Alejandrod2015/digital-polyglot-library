// src/components/StoryContent.tsx
import * as React from "react";

/**
 * Divide un bloque largo en párrafos de N oraciones y aplica tipografía legible,
 * manteniendo la interacción de selección de palabras y resaltando diálogos.
 */
export type StoryContentProps = {
  text: string;
  /** Oraciones por párrafo. 2–4 suele funcionar bien. */
  sentencesPerParagraph?: number;
  className?: string;
  onParagraphSelect?: (e: React.PointerEvent<HTMLParagraphElement>) => void;
  renderWord?: (t: string) => React.ReactNode;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function splitSentences(raw: string): string[] {
  // Normaliza saltos de línea a espacios únicos
  const text = raw.replace(/\s*\n+\s*/g, " ").trim();
  if (!text) return [];
  // Separa por signos de fin de frase, respetando comillas comunes
  const parts = text.split(/(?<=([.!?…]|\u203D|\u2047|\u2049)["»”’]?)(?:\s+|$)/u);
  return parts.map((s) => s.trim()).filter(Boolean);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ————————————————————————————————————————————————
// Detección robusta de diálogos
// Cubre comillas alemanas „…“ (U+201E U+201C), comillas tipográficas “…”/”…”
// así como comillas latinas «…» y comillas rectas "...".
const DIALOGUE_REGEX = /(„[\s\S]*?[“”]|[“”][\s\S]*?[“”]|«[\s\S]*?»|"[\s\S]*?")/gu;

function renderWithDialogues(
  paragraph: string,
  renderWord: (t: string) => React.ReactNode
) {
  // split con grupo capturante → intercala [narración, diálogo, narración, diálogo, ...]
  const segments = paragraph.split(DIALOGUE_REGEX);
  return segments.map((seg, idx) => {
    const isDialogue = idx % 2 === 1; // por el grupo capturante del split
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
  const sentences = React.useMemo(() => splitSentences(text), [text]);
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
    // tono más suave, parecido a la sinopsis
    "text-slate-700 dark:text-slate-300",
    // espacio generoso entre párrafos
    "space-y-5 sm:space-y-6",
    className
  )}
>
      {paragraphs.map((para, i) => (
        <p
          key={i}
          onPointerUp={onParagraphSelect}
          className={cx(
            "select-text antialiased",
            // Drop cap solo para el primer párrafo
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

// ————————————————————————————————————————————————————————————————
// USO en la página de historias
// Archivo: src/app/books/[bookId]/stories/page.tsx (fragmento)
/*
<StoryContent
  text={story.text}
  sentencesPerParagraph={3}
  onParagraphSelect={!isMobile ? handleParagraphSelection : undefined}
  renderWord={(t) => renderSelectableText(t)}
/>
*/