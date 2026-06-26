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
      if (!word || !definition) continue;
      output.push({ word, surface, definition, type, note });
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

/**
 * Re-orders practice items so the editorially most valuable ones come
 * first. Score combines three signals:
 *   - frequency in the story body (word repeated in text → more context
 *     for retention, stronger anchor for spaced review)
 *   - grammar-type diversity (round-robin across verb / noun / adj /
 *     expression so featured doesn't end up 8 nouns and 2 verbs)
 *   - original vocab order (tie-breaker, preserves editor intent)
 *
 * Used by `buildAndPersistStoryPracticeSet` to rank items BEFORE feeding
 * them into the featured plan, so the 10 that surface end-of-story are
 * the highest-value ones rather than just the first 10 in the JSON.
 *
 * Returns a new array; does not mutate input.
 */
export function rankItemsForFeatured(
  items: PracticeFavoriteItem[],
  text: string | null | undefined
): PracticeFavoriteItem[] {
  if (items.length === 0) return items;
  const cleanText = stripHtml(text ?? "").toLowerCase();

  // Type buckets. Round-robin across these so the top of the list
  // covers grammar diversity. Anything we can't classify (unknown type)
  // sits in `other`.
  const buckets = new Map<string, PracticeFavoriteItem[]>();
  const counted = items.map((item, originalIndex) => {
    const lemma = (item.word || "").toLowerCase().trim();
    // Frequency: search the body using a light stem so verb conjugations
    // and noun plurals count too. Lemma `amare` (5ch) stems to `ama`,
    // which catches `ama / ami / amo / amavo / amare` etc. Italian /
    // Spanish / Portuguese morphology lives almost entirely in suffixes
    // so a prefix-stem match is a decent first approximation without
    // pulling a real lemmatizer.
    let frequency = 0;
    if (lemma && cleanText) {
      const stemLen = Math.max(3, lemma.length - 2);
      const stem = lemma.slice(0, stemLen);
      const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // \bstem\w*; word starting with the stem, any suffix.
      const re = new RegExp(`\\b${escaped}\\w*`, "g");
      frequency = (cleanText.match(re) || []).length;
    }
    // Items with a non-null example sentence already proved they appear
    // somewhere in the body; bump them by 1 so frequency never reads 0
    // for words the story actually uses (the prefix-stem heuristic still
    // misses irregulars).
    if (frequency === 0 && item.exampleSentence) frequency = 1;
    return { item, originalIndex, frequency };
  });

  // Sort each bucket by frequency desc (then position asc).
  for (const c of counted) {
    const bucket = (c.item.wordType ?? "other").toLowerCase();
    const list = buckets.get(bucket) ?? [];
    list.push(c.item);
    buckets.set(bucket, list);
  }
  for (const [bucket, list] of buckets) {
    list.sort((a, b) => {
      const fa = counted.find((x) => x.item === a)!.frequency;
      const fb = counted.find((x) => x.item === b)!.frequency;
      if (fb !== fa) return fb - fa;
      const ia = counted.find((x) => x.item === a)!.originalIndex;
      const ib = counted.find((x) => x.item === b)!.originalIndex;
      return ia - ib;
    });
    buckets.set(bucket, list);
  }

  // Round-robin pick from buckets so featured is diverse. Order of
  // buckets favours expressions + verbs first (highest pedagogical
  // value: collocations + conjugations beat bare nouns), then nouns,
  // then adjectives, then anything else.
  const bucketOrder = ["expression", "verb", "noun", "adjective", "adj", "phrase", "idiom", "other"];
  const orderedBuckets = [
    ...bucketOrder.filter((name) => buckets.has(name) && (buckets.get(name)?.length ?? 0) > 0),
    ...Array.from(buckets.keys()).filter((name) => !bucketOrder.includes(name)),
  ];

  const ranked: PracticeFavoriteItem[] = [];
  while (ranked.length < items.length) {
    let anyTaken = false;
    for (const bucketName of orderedBuckets) {
      const list = buckets.get(bucketName);
      if (!list || list.length === 0) continue;
      ranked.push(list.shift()!);
      anyTaken = true;
      if (ranked.length === items.length) break;
    }
    if (!anyTaken) break;
  }
  return ranked;
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
      voiceId,
      audioWordStartSec: ranges?.audioWordStartSec ?? null,
      audioWordEndSec: ranges?.audioWordEndSec ?? null,
      audioSentenceStartSec: ranges?.audioSentenceStartSec ?? null,
      audioSentenceEndSec: ranges?.audioSentenceEndSec ?? null,
    });
  }

  return items;
}
