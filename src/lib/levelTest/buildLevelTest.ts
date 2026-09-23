import type { PracticeAudioClip, PracticeExercise } from "@/lib/practiceExercises";
import {
  LEVEL_TEST_STATION_SIZE,
  type LevelTestExercise,
  type LevelTestPayload,
  type LevelTestRung,
  type LevelTestStation,
} from "@domain/levelTest";
import { shuffleIndices, shuffleOptionsDeterministic } from "@/lib/practiceShuffle";
import { SPANISH_LEVEL_TEST_BANK, type BankStation } from "./bank.es";
import SPANISH_LEVEL_TEST_AUDIO from "./bank.es.audio.json";

/**
 * The level test, from a bank written FOR the test (2026-09-20, user:
 * "quiero que tengamos ejercicios dedicados para cada test de cada idioma",
 * one bank per language, the same for every variant). Until then it took
 * curated story exercises, which assumed the story had been read and mixed
 * in slang; both are wrong for a placement.
 *
 * Each rung has two stations of four exercises, one of each practice
 * format (listen, meaning, fill, match), with the test's own audio. The
 * app picks one station per rung at random.
 */

const BANKS: Record<string, { language: string; bank: Record<LevelTestRung, BankStation[]> }> = {
  spanish: { language: "spanish", bank: SPANISH_LEVEL_TEST_BANK },
};

export function hasListeningLevelTest(language: string | null | undefined): boolean {
  return Boolean(language && BANKS[language.toLowerCase()]);
}

/** Rungs served: the bank's rungs that have at least one full station. */
export const LADDER: LevelTestRung[] = ["A1", "A2", "B1", "B2", "C1"];

/** Exercises per station: four, or `LEVEL_TEST_EXERCISES_PER_STATION` on a
 *  local server to walk the flow quickly (1 while testing, 2026-09-20).
 *  The app scores whatever size it gets (`stationPassed`). */
function stationSize(): number {
  const raw = Number(process.env.LEVEL_TEST_EXERCISES_PER_STATION ?? "");
  return Number.isInteger(raw) && raw >= 1 && raw <= 10 ? raw : LEVEL_TEST_STATION_SIZE;
}

/** The test's own clips (`scripts/_genLevelTestClips.ts`): sentence and
 *  word text to public URL. Missing entries fall back to runtime TTS. */
type BankAudio = { sentences: Record<string, string>; words: Record<string, string> };
const AUDIO: Record<string, BankAudio> = { spanish: SPANISH_LEVEL_TEST_AUDIO as BankAudio };

function sentenceClip(language: string, sentence: string): PracticeAudioClip | null {
  const url = AUDIO[language]?.sentences[sentence];
  return url ? { storySlug: "", sentence, storySource: "standalone", language, cachedUrl: url, clipUrl: url } : null;
}

function wordClip(language: string, word: string, sentence: string): PracticeAudioClip | null {
  const url = AUDIO[language]?.words[word];
  return url ? { storySlug: "", sentence, storySource: "standalone", language, targetWord: word, wordClipUrl: url } : null;
}

/** The plain sentence of a `[[...]]`-marked one. */
const unmark = (s: string) => s.replace(/\[\[(.+?)\]\]/g, "$1");

/** The four exercises of a station, in the shape `/api/story-practice`
 *  serves, so the app renders them with the very components it uses after
 *  a story. The bank keeps the right answer first (easy to author and to
 *  lint); the clients render options in array order, so shuffle here,
 *  seeded by the exercise id like the curated sets are. */
export function stationExercises(station: BankStation, id: string, language: string): PracticeExercise[] {
  const listenOrder = shuffleIndices(4, `${id}-listen`);
  const listen: PracticeExercise = {
    id: `listen_choose:${id}-listen`,
    type: "listen_choose",
    prompt: "Which sentence did you hear?",
    speechText: station.listen.sentence,
    language,
    options: listenOrder.map((i) => station.listen.options[i]),
    optionTranslations: listenOrder.map((i) => station.listen.translations[i]),
    audioClip: sentenceClip(language, station.listen.sentence),
    answer: station.listen.sentence,
  };
  const meaningSentence = unmark(station.meaning.sentence);
  const meaning: PracticeExercise = {
    id: `meaning_in_context:${id}-meaning`,
    type: "meaning_in_context",
    prompt: "Choose the meaning in context.",
    word: station.meaning.word,
    sentence: meaningSentence,
    storySlug: null,
    audioClip: wordClip(language, station.meaning.word, meaningSentence),
    options: shuffleOptionsDeterministic([...station.meaning.options], `${id}-meaning`),
    answer: station.meaning.options[0],
  };
  const fillSentence = unmark(station.fill.sentence);
  const fillOrder = shuffleIndices(4, `${id}-fill`);
  const fill: PracticeExercise = {
    id: `fill_blank:${id}-fill`,
    type: "fill_blank",
    prompt: "Complete the sentence.",
    sentence: station.fill.sentence.replace(/\[\[.+?\]\]/, "_____"),
    translation: station.fill.translation,
    optionTranslations: fillOrder.map((i) => station.fill.optionTranslations[i]),
    storySlug: null,
    audioClip: sentenceClip(language, fillSentence),
    options: fillOrder.map((i) => station.fill.options[i]),
    answer: station.fill.options[0],
  };
  const meanings = station.match.pairs.map((p) => p.meaning);
  const match: PracticeExercise = {
    id: `match_meaning:${id}-match`,
    type: "match_meaning",
    prompt: "Match each word with its meaning.",
    pairs: station.match.pairs.map((pair, i) => ({
      word: pair.word,
      answer: pair.meaning,
      options: shuffleOptionsDeterministic([...meanings], `${id}-match-${i}`),
      language,
      wordClipUrl: AUDIO[language]?.words[pair.word] ?? null,
    })),
  };
  return [listen, meaning, fill, match];
}

/** The rung's stations, one exercise of each format. With the local size
 *  override under four, each station keeps `size` formats, rotating so a
 *  walk through the ladder still shows every format. */
export function stationsForRung(
  stations: BankStation[],
  level: LevelTestRung,
  language: string,
  rungIndex: number
): LevelTestStation[] {
  const size = stationSize();
  return stations.map((station, n) => {
    const id = `${language}-${level.toLowerCase()}-${n}`;
    const all = stationExercises(station, id, language);
    const start = (rungIndex * stations.length + n) % all.length;
    const exercises = size >= all.length ? all : Array.from({ length: size }, (_, i) => all[(start + i) % all.length]);
    return {
      id,
      level,
      story: { slug: "", title: "" },
      exercises: exercises as unknown as LevelTestExercise[],
    };
  });
}

export type StationProblem = { level: LevelTestRung; reason: string };

export async function buildLevelTest(
  language: string,
  variant: string | null | undefined
): Promise<{ payload: LevelTestPayload; problems: StationProblem[] } | null> {
  const entry = BANKS[language.toLowerCase()];
  if (!entry) return null;
  // One bank per language: the variant is accepted for compatibility with
  // the app's call and ignored on purpose (user, 2026-09-20).
  void variant;
  const stations: LevelTestStation[] = [];
  const problems: StationProblem[] = [];
  LADDER.forEach((level, rungIndex) => {
    const built = stationsForRung(entry.bank[level] ?? [], level, entry.language, rungIndex);
    if (built.length === 0) problems.push({ level, reason: `bank has no full station for ${level}` });
    stations.push(...built);
  });
  return {
    payload: {
      language,
      variant: "all",
      ladder: LADDER.filter((level) => stations.some((s) => s.level === level)),
      stations,
    },
    problems,
  };
}
