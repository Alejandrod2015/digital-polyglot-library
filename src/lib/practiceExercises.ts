import { books } from "@/data/books";
import { splitStoryTextIntoSentences } from "@/lib/audioSegments";
import { normalizeVocabType } from "@/lib/vocabTypes";
import { getSegmentIdFromSourcePath, getStorySource, isStandaloneSourcePath } from "@/lib/storySource";

export type PracticeFavoriteItem = {
  word: string;
  translation: string;
  wordType?: string | null;
  exampleSentence?: string | null;
  storySlug?: string | null;
  storyTitle?: string | null;
  sourcePath?: string | null;
  language?: string | null;
  nextReviewAt?: string | null;
  practiceSource?: "curriculum" | "user_saved" | "both" | null;
};

export type PracticeMode =
  | "meaning"
  | "context"
  | "natural"
  | "listening"
  | "match";

export type FillBlankExercise = {
  id: string;
  type: "fill_blank";
  prompt: string;
  sentence: string;
  storySlug?: string | null;
  audioClip?: PracticeAudioClip | null;
  options: string[];
  answer: string;
};

export type MeaningContextExercise = {
  id: string;
  type: "meaning_in_context";
  prompt: string;
  word: string;
  sentence: string;
  storySlug?: string | null;
  audioClip?: PracticeAudioClip | null;
  options: string[];
  answer: string;
};

export type NaturalExpressionExercise = {
  id: string;
  type: "natural_expression";
  prompt: string;
  sentence: string;
  storySlug?: string | null;
  audioClip?: PracticeAudioClip | null;
  options: string[];
  answer: string;
};

export type ListenChooseExercise = {
  id: string;
  type: "listen_choose";
  prompt: string;
  speechText: string;
  language: string | null;
  options: string[];
  answer: string;
};

export type MatchMeaningExercise = {
  id: string;
  type: "match_meaning";
  prompt: string;
  pairs: Array<{
    word: string;
    answer: string;
    options: string[];
  }>;
};

export type PracticeAudioClip = {
  storySlug: string;
  sentence: string;
  storySource: "user" | "standalone";
  language?: string | null;
  targetWord?: string | null;
  segmentId?: string | null;
};

export type PracticeExercise =
  | FillBlankExercise
  | MeaningContextExercise
  | NaturalExpressionExercise
  | ListenChooseExercise
  | MatchMeaningExercise;

function normalizeText(value?: string | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKey(value?: string | null): string {
  return normalizeText(value).toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function mergePracticeSource(
  current?: PracticeFavoriteItem["practiceSource"],
  incoming?: PracticeFavoriteItem["practiceSource"]
): PracticeFavoriteItem["practiceSource"] {
  if (current === "both" || incoming === "both") return "both";
  if (!current) return incoming ?? null;
  if (!incoming) return current;
  return current === incoming ? current : "both";
}

function pickPreferredValue(current?: string | null, incoming?: string | null): string | null | undefined {
  const currentText = normalizeText(current);
  const incomingText = normalizeText(incoming);
  if (!currentText) return incomingText || current || incoming;
  if (!incomingText) return current;
  return incomingText.length > currentText.length ? incoming : current;
}

function mergePracticeItem(current: PracticeFavoriteItem, incoming: PracticeFavoriteItem): PracticeFavoriteItem {
  const currentNextReviewAt = current.nextReviewAt ? Date.parse(current.nextReviewAt) : Number.NaN;
  const incomingNextReviewAt = incoming.nextReviewAt ? Date.parse(incoming.nextReviewAt) : Number.NaN;

  return {
    ...current,
    translation: pickPreferredValue(current.translation, incoming.translation) ?? current.translation,
    wordType: pickPreferredValue(current.wordType, incoming.wordType) ?? current.wordType,
    exampleSentence: pickPreferredValue(current.exampleSentence, incoming.exampleSentence) ?? current.exampleSentence,
    storySlug: pickPreferredValue(current.storySlug, incoming.storySlug) ?? current.storySlug,
    storyTitle: pickPreferredValue(current.storyTitle, incoming.storyTitle) ?? current.storyTitle,
    sourcePath: pickPreferredValue(current.sourcePath, incoming.sourcePath) ?? current.sourcePath,
    language: pickPreferredValue(current.language, incoming.language) ?? current.language,
    nextReviewAt:
      Number.isFinite(currentNextReviewAt) && Number.isFinite(incomingNextReviewAt)
        ? currentNextReviewAt <= incomingNextReviewAt
          ? current.nextReviewAt
          : incoming.nextReviewAt
        : current.nextReviewAt ?? incoming.nextReviewAt ?? null,
    practiceSource: mergePracticeSource(current.practiceSource, incoming.practiceSource),
  };
}

export function mergePracticeItemsByWord(items: PracticeFavoriteItem[]): PracticeFavoriteItem[] {
  const merged = new Map<string, PracticeFavoriteItem>();
  for (const item of items) {
    const key = `${normalizeKey(item.language)}::${normalizeKey(item.word)}`;
    if (!normalizeText(item.word)) continue;
    const existing = merged.get(key);
    merged.set(key, existing ? mergePracticeItem(existing, item) : item);
  }
  return Array.from(merged.values());
}

function uniqueByWord(items: PracticeFavoriteItem[]): PracticeFavoriteItem[] {
  return mergePracticeItemsByWord(items);
}

function inferCatalogPool(): PracticeFavoriteItem[] {
  const items: PracticeFavoriteItem[] = [];
  for (const book of Object.values(books)) {
    for (const story of book.stories ?? []) {
      for (const vocab of story.vocab ?? []) {
        const word = normalizeText(vocab.word);
        const translation = normalizeText(vocab.definition);
        if (!word || !translation) continue;
        items.push({
          word,
          translation,
          wordType:
            normalizeVocabType(vocab.type, {
              word,
              definition: translation,
            }) ?? null,
          exampleSentence: normalizeText(vocab.note) || null,
          storySlug: normalizeText(story.slug) || null,
          storyTitle: normalizeText(story.title) || null,
          sourcePath: `/books/${book.slug}/${story.slug}`,
          language: normalizeText(story.language || book.language) || null,
          practiceSource: "curriculum",
        });
      }
    }
  }
  return uniqueByWord(items);
}

const catalogPool = inferCatalogPool();

function getLanguagePool(
  language: string | null | undefined,
  source: PracticeFavoriteItem[]
): PracticeFavoriteItem[] {
  const key = normalizeKey(language);
  if (!key) return source;
  const filtered = source.filter((item) => normalizeKey(item.language) === key);
  return filtered.length > 0 ? filtered : source;
}

function getDistractorWords(
  item: PracticeFavoriteItem,
  pool: PracticeFavoriteItem[],
  max = 3
): string[] {
  return shuffle(
    uniqueByWord(
      pool.filter(
        (candidate) =>
          normalizeKey(candidate.word) !== normalizeKey(item.word) &&
          normalizeText(candidate.word)
      )
    )
  )
    .slice(0, max)
    .map((candidate) => candidate.word);
}

function getDistractorMeanings(
  item: PracticeFavoriteItem,
  pool: PracticeFavoriteItem[],
  max = 3
): string[] {
  const seen = new Set<string>([normalizeKey(item.translation)]);
  const out: string[] = [];
  for (const candidate of shuffle(pool)) {
    const translation = normalizeText(candidate.translation);
    const key = normalizeKey(translation);
    if (!translation || seen.has(key)) continue;
    seen.add(key);
    out.push(translation);
    if (out.length >= max) break;
  }
  return out;
}

function getSentenceWithBlank(item: PracticeFavoriteItem): string | null {
  const sentence = isStandaloneSourcePath(item.sourcePath, item.storySlug)
    ? getContextSentence(item)
    : normalizeText(item.exampleSentence);
  const word = normalizeText(item.word);
  if (!sentence || !word) return null;
  const pattern = new RegExp(escapeRegExp(word), "i");
  if (!pattern.test(sentence)) return null;
  return shortenSentence(sentence.replace(pattern, "_____"));
}

function getContextSentence(item: PracticeFavoriteItem): string {
  const sentence = normalizeText(item.exampleSentence);
  if (!sentence) return "";

  const sentences = splitStoryTextIntoSentences(sentence);
  if (sentences.length <= 1) return sentence;

  const word = normalizeText(item.word).toLowerCase();
  if (!word) return sentences[0] ?? sentence;

  return (
    sentences.find((candidate) => candidate.toLowerCase().includes(word)) ??
    sentences[0] ??
    sentence
  );
}

function shortenSentence(sentence: string): string {
  const normalized = normalizeText(sentence);
  if (!normalized) return "";

  const splitOnStrongPunctuation = normalized
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const firstSentence = splitOnStrongPunctuation[0] ?? normalized;

  if (firstSentence.length <= 140) return firstSentence;

  const splitOnComma = firstSentence
    .split(/,\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const firstClause = splitOnComma[0] ?? firstSentence;

  if (firstClause.length <= 110) return firstClause;

  const words = firstClause.split(/\s+/).filter(Boolean);
  if (words.length <= 14) return firstClause;
  return `${words.slice(0, 14).join(" ")}...`;
}

function buildAudioClip(item: PracticeFavoriteItem, sentence: string): PracticeAudioClip | null {
  const storySlug = normalizeText(item.storySlug);
  if (!storySlug) return null;
  return {
    storySlug,
    sentence,
    storySource: getStorySource(item.sourcePath, item.storySlug),
    language: item.language ?? null,
    targetWord: normalizeText(item.word) || null,
    segmentId: getSegmentIdFromSourcePath(item.sourcePath),
  };
}

function isExpression(item: PracticeFavoriteItem): boolean {
  const normalizedType = normalizeVocabType(item.wordType, {
    word: item.word,
    definition: item.translation,
  });
  return normalizedType === "expression" || normalizeText(item.word).includes(" ");
}

function createFillBlankExercise(
  item: PracticeFavoriteItem,
  pool: PracticeFavoriteItem[]
): FillBlankExercise | null {
  const fullSentence = getContextSentence(item);
  const sentence = getSentenceWithBlank(item);
  if (!sentence || !fullSentence) return null;
  const options = shuffle([item.word, ...getDistractorWords(item, getLanguagePool(item.language, pool))]);
  if (options.length < 4) return null;
  return {
    id: `fill_blank:${normalizeKey(item.word)}`,
    type: "fill_blank",
    prompt: "Complete the sentence with the right word or expression.",
    sentence,
    storySlug: item.storySlug ?? null,
    audioClip: buildAudioClip(item, fullSentence),
    options,
    answer: item.word,
  };
}

function createMeaningContextExercise(
  item: PracticeFavoriteItem,
  pool: PracticeFavoriteItem[]
): MeaningContextExercise | null {
  const fullSentence = isStandaloneSourcePath(item.sourcePath, item.storySlug)
    ? getContextSentence(item)
    : normalizeText(item.exampleSentence);
  const sentence = shortenSentence(fullSentence);
  if (!sentence) return null;
  const options = shuffle([
    item.translation,
    ...getDistractorMeanings(item, getLanguagePool(item.language, pool)),
  ]);
  if (options.length < 4) return null;
  return {
    id: `meaning_in_context:${normalizeKey(item.word)}`,
    type: "meaning_in_context",
    prompt: "Choose the meaning that fits this word in context.",
    word: item.word,
    sentence,
    storySlug: item.storySlug ?? null,
    audioClip: buildAudioClip(item, isStandaloneSourcePath(item.sourcePath, item.storySlug) ? fullSentence : sentence),
    options,
    answer: item.translation,
  };
}

function createNaturalExpressionExercise(
  item: PracticeFavoriteItem,
  pool: PracticeFavoriteItem[]
): NaturalExpressionExercise | null {
  if (!isExpression(item)) return null;
  const sentence = getSentenceWithBlank(item);
  const fullSentence = isStandaloneSourcePath(item.sourcePath, item.storySlug)
    ? getContextSentence(item)
    : normalizeText(item.exampleSentence);
  if (!sentence || !fullSentence) return null;
  const expressionPool = getLanguagePool(item.language, pool).filter((candidate) => isExpression(candidate));
  const options = shuffle([item.word, ...getDistractorWords(item, expressionPool)]);
  if (options.length < 4) return null;
  return {
    id: `natural_expression:${normalizeKey(item.word)}`,
    type: "natural_expression",
    prompt: "Which expression sounds natural here?",
    sentence,
    storySlug: item.storySlug ?? null,
    audioClip: buildAudioClip(item, isStandaloneSourcePath(item.sourcePath, item.storySlug) ? fullSentence : sentence),
    options,
    answer: item.word,
  };
}

function createListenChooseExercise(
  item: PracticeFavoriteItem,
  pool: PracticeFavoriteItem[]
): ListenChooseExercise | null {
  const options = shuffle([item.word, ...getDistractorWords(item, getLanguagePool(item.language, pool))]);
  if (options.length < 4) return null;
  return {
    id: `listen_choose:${normalizeKey(item.word)}`,
    type: "listen_choose",
    prompt: "Listen and choose the word you hear.",
    speechText: item.word,
    language: item.language ?? null,
    options,
    answer: item.word,
  };
}

function createMatchMeaningExercise(items: PracticeFavoriteItem[]): MatchMeaningExercise | null {
  const candidates = uniqueByWord(items).filter(
    (item) => normalizeText(item.word) && normalizeText(item.translation)
  );
  if (candidates.length < 4) return null;
  const selected = shuffle(candidates).slice(0, 4);
  const meanings = shuffle(selected.map((item) => item.translation));
  const pairs = selected.map((item) => ({
    word: item.word,
    answer: item.translation,
    options: meanings,
  }));
  return {
    id: `match_meaning:${selected.map((item) => normalizeKey(item.word)).join("|")}`,
    type: "match_meaning",
    prompt: "Match the words to their meanings.",
    pairs,
  };
}

export function getDuePracticeItems(items: PracticeFavoriteItem[]): PracticeFavoriteItem[] {
  const now = Date.now();
  return items.filter((item) => {
    if (!item.nextReviewAt) return true;
    const nextReviewAt = Date.parse(item.nextReviewAt);
    return !Number.isFinite(nextReviewAt) || nextReviewAt <= now;
  });
}

function getPracticeSource(items: PracticeFavoriteItem[]): PracticeFavoriteItem[] {
  const all = uniqueByWord(items);
  const due = uniqueByWord(getDuePracticeItems(all));
  if (due.length === 0) return all;
  const dueKeys = new Set(due.map((item) => `${normalizeKey(item.language)}::${normalizeKey(item.word)}`));
  const sourceWeight = (item: PracticeFavoriteItem) => {
    switch (item.practiceSource) {
      case "both":
        return 3;
      case "curriculum":
      case "user_saved":
        return 2;
      default:
        return 1;
    }
  };
  const sortByPriority = (pool: PracticeFavoriteItem[]) =>
    [...pool].sort((a, b) => {
      const weightDiff = sourceWeight(b) - sourceWeight(a);
      if (weightDiff !== 0) return weightDiff;
      const aReview = a.nextReviewAt ? Date.parse(a.nextReviewAt) : Number.NaN;
      const bReview = b.nextReviewAt ? Date.parse(b.nextReviewAt) : Number.NaN;
      if (Number.isFinite(aReview) && Number.isFinite(bReview) && aReview !== bReview) {
        return aReview - bReview;
      }
      return a.word.localeCompare(b.word);
    });

  return [
    ...sortByPriority(due),
    ...sortByPriority(all.filter((item) => !dueKeys.has(`${normalizeKey(item.language)}::${normalizeKey(item.word)}`))),
  ];
}

export function buildPracticeSession(
  items: PracticeFavoriteItem[],
  mode: PracticeMode
): PracticeExercise[] {
  const source = getPracticeSource(items);
  if (source.length === 0) return [];

  const languageAwarePool = uniqueByWord([...source, ...catalogPool]);
  const exercises: PracticeExercise[] = [];

  if (mode === "match") {
    let remaining = uniqueByWord(source);
    for (let i = 0; i < 3 && exercises.length < 10; i += 1) {
      const exercise = createMatchMeaningExercise(shuffle(remaining));
      if (exercise && !exercises.some((existing) => existing.id === exercise.id)) {
        exercises.push(exercise);
        const usedKeys = new Set(
          exercise.pairs.map(
            (pair) => `${normalizeKey(remaining.find((item) => item.word === pair.word)?.language)}::${normalizeKey(pair.word)}`
          )
        );
        remaining = remaining.filter(
          (item) => !usedKeys.has(`${normalizeKey(item.language)}::${normalizeKey(item.word)}`)
        );
      }
    }
    return exercises;
  }

  const builder =
    mode === "meaning"
      ? createMeaningContextExercise
      : mode === "context"
        ? createFillBlankExercise
        : mode === "natural"
          ? createNaturalExpressionExercise
          : createListenChooseExercise;

  for (const item of source) {
    if (exercises.length >= 10) break;
    const exercise = builder(item, languageAwarePool);
    if (!exercise) continue;
    if (exercises.some((existing) => existing.id === exercise.id)) continue;
    exercises.push(exercise);
  }

  return exercises;
}

function getExerciseAnchor(exercise: PracticeExercise): string {
  switch (exercise.type) {
    case "meaning_in_context":
      return normalizeKey(exercise.word);
    case "fill_blank":
    case "natural_expression":
    case "listen_choose":
      return normalizeKey(exercise.answer);
    case "match_meaning":
      return normalizeKey(exercise.pairs.map((pair) => pair.word).join("|"));
  }
}

export function buildMixedPracticeSession(
  items: PracticeFavoriteItem[],
  plan: PracticeMode[],
  maxExercises = 10
): PracticeExercise[] {
  const sessionsByMode = new Map<PracticeMode, PracticeExercise[]>(
    plan.map((mode) => [mode, buildPracticeSession(items, mode)])
  );
  const nextIndexByMode = new Map<PracticeMode, number>(plan.map((mode) => [mode, 0]));
  const usedAnchors = new Set<string>();
  const exercises: PracticeExercise[] = [];

  for (const mode of plan) {
    if (exercises.length >= maxExercises) break;
    const session = sessionsByMode.get(mode) ?? [];
    let index = nextIndexByMode.get(mode) ?? 0;

    while (index < session.length) {
      const candidate = session[index];
      index += 1;
      const anchor = getExerciseAnchor(candidate);
      if (usedAnchors.has(anchor)) continue;
      usedAnchors.add(anchor);
      exercises.push(candidate);
      break;
    }

    nextIndexByMode.set(mode, index);
  }

  if (exercises.length >= maxExercises) return exercises.slice(0, maxExercises);

  for (const mode of [("meaning" as const), ("context" as const), ("natural" as const), ("listening" as const)]) {
    if (exercises.length >= maxExercises) break;
    const session = sessionsByMode.get(mode) ?? [];
    let index = nextIndexByMode.get(mode) ?? 0;

    while (index < session.length && exercises.length < maxExercises) {
      const candidate = session[index];
      index += 1;
      const anchor = getExerciseAnchor(candidate);
      if (usedAnchors.has(anchor)) continue;
      usedAnchors.add(anchor);
      exercises.push(candidate);
    }

    nextIndexByMode.set(mode, index);
  }

  return exercises;
}

export function buildTopicCheckpointPracticeSession(items: PracticeFavoriteItem[]): PracticeExercise[] {
  return buildMixedPracticeSession(
    items,
    ["meaning", "context", "listening", "meaning", "context", "listening", "natural", "meaning"],
    8
  );
}

export function getSpeechSynthesisLang(language?: string | null): string {
  switch (normalizeKey(language)) {
    case "spanish":
      return "es-ES";
    case "german":
      return "de-DE";
    case "french":
      return "fr-FR";
    case "italian":
      return "it-IT";
    case "portuguese":
      return "pt-BR";
    case "japanese":
      return "ja-JP";
    case "korean":
      return "ko-KR";
    case "chinese":
      return "zh-CN";
    default:
      return "en-US";
  }
}
