import type { VocabItem } from "@/types/books";
import type { AudioWordTimingsPayload } from "@domain";
import type { PracticeFavoriteItem } from "@/lib/practiceExercises";
import { normalizeVocabType } from "@/lib/vocabTypes";
import { computePracticeAudioRanges } from "@/lib/practiceAudioRanges";

type LooseVocabItem = {
  word: string;
  surface?: string | null;
  definition: string;
  type?: string | null;
  note?: string | null;
  priority?: number | null;
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
      const surface = normalizeText(typeof record.surface === "string" ? record.surface : "") || null;
      const definition = normalizeText(typeof record.definition === "string" ? record.definition : "");
      const type = normalizeText(typeof record.type === "string" ? record.type : "") || null;
      const note = normalizeText(typeof record.note === "string" ? record.note : "") || null;
      const priorityRaw = record.priority;
      const priority =
        typeof priorityRaw === "number" && priorityRaw >= 1 && priorityRaw <= 3
          ? Math.round(priorityRaw)
          : null;
      if (!word || !definition) continue;
      output.push({ word, surface, definition, type, note, priority });
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

  // Tolerate an optional closing quote/guillemet between the
  // sentence-ending punctuation and the whitespace. The previous
  // /(?<=[.!?])\s+/ missed cases like `bello."\nIl cameriere...` —
  // the smart quote after the period blocked the split, gluing two
  // sentences into one and breaking practice exercises that surfaced
  // the joined chunk as "context".
  const sentences = cleanText
    .split(/(?<=[.!?][”’"'»]?)\s+/)
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
  /** Narration voiceId; propagated so practice TTS can render in the
   *  same voice the user heard reading the story. */
  voiceId?: string | null;
  /** Story's aeneas word-level alignment. When provided, each vocab
   *  item gets exact audio start/end ranges, eliminating the need for
   *  fuzzy segment matching on mobile. Pass null for legacy stories
   *  without alignment (audio falls back to HQ TTS at runtime). */
  audioWordTimings?: AudioWordTimingsPayload | null;
}): PracticeFavoriteItem[] {
  const storyTitle = normalizeText(params.title);
  const storySlug = normalizeText(params.slug);
  const cleanText = normalizeText(params.text);
  const language = normalizeText(params.language ?? "") || null;
  const sourcePath = normalizeText(params.sourcePath);
  const practiceSource = params.practiceSource ?? "curriculum";
  const voiceId = params.voiceId ?? null;
  const timings = params.audioWordTimings ?? null;

  if (!storySlug || !sourcePath) return [];

  const items: PracticeFavoriteItem[] = [];

  for (const item of params.vocab) {
    const word = normalizeText(item.word);
    const translation = normalizeText(item.definition);
    if (!word || !translation) continue;

    // The `word` is the lemma we teach; `surface` is the form actually
    // present in the story body. When both exist we prefer `surface` for
    // the audio range lookup so a vocab like {word:"comprare", surface:"compra"}
    // resolves to the conjugated token in the text instead of falling
    // back to TTS because the infinitive isn't in the body.
    const surfaceCandidate = normalizeText(
      "surface" in item && typeof (item as { surface?: unknown }).surface === "string"
        ? ((item as { surface?: string }).surface as string)
        : "",
    );
    const lookupWord = surfaceCandidate || word;

    const exampleSentence =
      normalizeText("note" in item && typeof item.note === "string" ? item.note : "") ||
      getContextSentence(cleanText, lookupWord) ||
      getContextSentence(cleanText, word) ||
      undefined;

    const ranges = timings
      ? computePracticeAudioRanges({
          targetWord: lookupWord,
          timings,
          preferredContext: exampleSentence ?? null,
        })
      : null;

    const priorityField = (item as { priority?: unknown }).priority;
    const priority =
      typeof priorityField === "number" && priorityField >= 1 && priorityField <= 3
        ? Math.round(priorityField)
        : null;

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
      priority,
      voiceId,
      audioWordStartSec: ranges?.audioWordStartSec ?? null,
      audioWordEndSec: ranges?.audioWordEndSec ?? null,
      audioSentenceStartSec: ranges?.audioSentenceStartSec ?? null,
      audioSentenceEndSec: ranges?.audioSentenceEndSec ?? null,
    });
  }

  return items;
}
