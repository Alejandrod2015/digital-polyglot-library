import type { VocabItem } from "@/types/books";
import type { PracticeFavoriteItem } from "@/lib/practiceExercises";
import { normalizeVocabType } from "@/lib/vocabTypes";

type LooseVocabItem = {
  word: string;
  definition: string;
  type?: string | null;
  note?: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function stripHtml(value: string): string {
  return value
    .replace(/<\/(p|blockquote|div|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function parseLooseVocab(input: unknown): LooseVocabItem[] {
  const parseArray = (items: unknown[]): LooseVocabItem[] => {
    const output: LooseVocabItem[] = [];

    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const word = normalizeText(typeof record.word === "string" ? record.word : "");
      const definition = normalizeText(typeof record.definition === "string" ? record.definition : "");
      const type = normalizeText(typeof record.type === "string" ? record.type : "") || null;
      const note = normalizeText(typeof record.note === "string" ? record.note : "") || null;
      if (!word || !definition) continue;
      output.push({ word, definition, type, note });
    }

    return output;
  };

  if (Array.isArray(input)) return parseArray(input);
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input) as unknown;
      return Array.isArray(parsed) ? parseArray(parsed) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getContextSentence(text: string, word: string): string | null {
  const cleanText = stripHtml(text);
  const normalizedWord = normalizeText(word).toLowerCase();
  if (!cleanText || !normalizedWord) return null;

  const sentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return (
    sentences.find((sentence) => sentence.toLowerCase().includes(normalizedWord)) ??
    sentences[0] ??
    null
  );
}

export function buildPracticeItemsFromStory(params: {
  title: string;
  slug: string;
  text: string | null | undefined;
  language?: string | null;
  sourcePath: string;
  vocab: VocabItem[] | LooseVocabItem[];
  practiceSource?: PracticeFavoriteItem["practiceSource"];
}): PracticeFavoriteItem[] {
  const storyTitle = normalizeText(params.title);
  const storySlug = normalizeText(params.slug);
  const cleanText = normalizeText(params.text);
  const language = normalizeText(params.language ?? "") || null;
  const sourcePath = normalizeText(params.sourcePath);
  const practiceSource = params.practiceSource ?? "curriculum";

  if (!storySlug || !sourcePath) return [];

  const items: PracticeFavoriteItem[] = [];

  for (const item of params.vocab) {
    const word = normalizeText(item.word);
    const translation = normalizeText(item.definition);
    if (!word || !translation) continue;

    const exampleSentence =
      normalizeText("note" in item && typeof item.note === "string" ? item.note : "") ||
      getContextSentence(cleanText, word) ||
      undefined;

    items.push({
      word,
      translation,
      wordType:
        normalizeVocabType("type" in item ? item.type ?? undefined : undefined, {
          word,
          definition: translation,
        }) ?? null,
      exampleSentence,
      storySlug,
      storyTitle,
      sourcePath,
      language,
      practiceSource,
    });
  }

  return items;
}
