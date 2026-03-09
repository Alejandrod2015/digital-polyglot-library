import { books } from "@/data/books";
import { normalizeVocabType } from "@/lib/vocabTypes";

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
  options: string[];
  answer: string;
};

export type MeaningContextExercise = {
  id: string;
  type: "meaning_in_context";
  prompt: string;
  word: string;
  sentence: string;
  options: string[];
  answer: string;
};

export type NaturalExpressionExercise = {
  id: string;
  type: "natural_expression";
  prompt: string;
  sentence: string;
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

function uniqueByWord(items: PracticeFavoriteItem[]): PracticeFavoriteItem[] {
  const seen = new Set<string>();
  const out: PracticeFavoriteItem[] = [];
  for (const item of items) {
    const key = `${normalizeKey(item.language)}::${normalizeKey(item.word)}`;
    if (!normalizeText(item.word) || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
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
  const sentence = normalizeText(item.exampleSentence);
  const word = normalizeText(item.word);
  if (!sentence || !word) return null;
  const pattern = new RegExp(escapeRegExp(word), "i");
  if (!pattern.test(sentence)) return null;
  return shortenSentence(sentence.replace(pattern, "_____"));
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
  const sentence = getSentenceWithBlank(item);
  if (!sentence) return null;
  const options = shuffle([item.word, ...getDistractorWords(item, getLanguagePool(item.language, pool))]);
  if (options.length < 4) return null;
  return {
    id: `fill_blank:${normalizeKey(item.word)}`,
    type: "fill_blank",
    prompt: "Complete the sentence with the right word or expression.",
    sentence,
    options,
    answer: item.word,
  };
}

function createMeaningContextExercise(
  item: PracticeFavoriteItem,
  pool: PracticeFavoriteItem[]
): MeaningContextExercise | null {
  const sentence = shortenSentence(normalizeText(item.exampleSentence));
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
  if (!sentence) return null;
  const expressionPool = getLanguagePool(item.language, pool).filter((candidate) => isExpression(candidate));
  const options = shuffle([item.word, ...getDistractorWords(item, expressionPool)]);
  if (options.length < 4) return null;
  return {
    id: `natural_expression:${normalizeKey(item.word)}`,
    type: "natural_expression",
    prompt: "Which expression sounds natural here?",
    sentence,
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
  const due = uniqueByWord(getDuePracticeItems(items));
  const all = uniqueByWord(items);
  if (due.length === 0) return all;
  const dueKeys = new Set(due.map((item) => `${normalizeKey(item.language)}::${normalizeKey(item.word)}`));
  return [...due, ...all.filter((item) => !dueKeys.has(`${normalizeKey(item.language)}::${normalizeKey(item.word)}`))];
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
    for (let i = 0; i < 3 && exercises.length < 10; i += 1) {
      const exercise = createMatchMeaningExercise(shuffle(source));
      if (exercise && !exercises.some((existing) => existing.id === exercise.id)) {
        exercises.push(exercise);
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
