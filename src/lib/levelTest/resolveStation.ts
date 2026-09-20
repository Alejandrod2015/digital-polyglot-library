import type { LevelTestClip, LevelTestStation } from "@domain/levelTest";
import type { AuthoredStation } from "./stations.es";

type StoredFragment = {
  url?: string;
  text?: string;
  index?: number;
  startSec?: number;
  endSec?: number;
};

type StoredVocab = { word?: string; definition?: string; type?: string };

/** Why a station could not be served; the check script prints these. */
export type StationProblem = { stationId: string; reason: string };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Small deterministic PRNG so option order is stable per station. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Turn one authored station into what the app plays: the clip URLs and
 * text from `audioFragments`, and the vocabulary question from the story's
 * own glosses (the right definition plus three others from the same
 * story, so every option reads in the same voice).
 */
export function resolveStation(
  authored: AuthoredStation,
  story: {
    slug: string;
    title: string;
    audioFragments: unknown;
    vocab: unknown;
  }
): { station: LevelTestStation } | { problem: StationProblem } {
  const fragments = Array.isArray(story.audioFragments)
    ? (story.audioFragments as StoredFragment[])
    : [];
  const clips: LevelTestClip[] = [];
  for (const index of authored.fragments) {
    const fragment = fragments[index];
    if (!fragment || typeof fragment.url !== "string" || typeof fragment.text !== "string") {
      return { problem: { stationId: authored.id, reason: `fragment ${index} missing` } };
    }
    clips.push({
      url: fragment.url,
      text: fragment.text,
      durationSec: Math.max(0, (fragment.endSec ?? 0) - (fragment.startSec ?? 0)),
    });
  }

  const vocab = (Array.isArray(story.vocab) ? (story.vocab as StoredVocab[]) : []).filter(
    (v): v is { word: string; definition: string; type?: string } =>
      typeof v.word === "string" && typeof v.definition === "string" && v.definition.length > 0
  );
  const target = vocab.find((v) => norm(v.word) === norm(authored.vocabWord));
  if (!target) {
    return { problem: { stationId: authored.id, reason: `vocab "${authored.vocabWord}" not in story` } };
  }
  const clipText = norm(clips.map((c) => c.text).join(" "));
  if (!clipText.includes(norm(authored.vocabWord))) {
    return { problem: { stationId: authored.id, reason: `vocab "${authored.vocabWord}" not in clip` } };
  }

  // Distractors of the same part of speech first: a gloss that starts
  // "Dries;" next to a noun gives the answer away by elimination.
  const random = seeded(authored.id);
  const others = vocab.filter((v) => v.word !== target.word && v.definition !== target.definition);
  const sameType = others.filter((v) => target.type && v.type === target.type);
  const distractors = [
    ...shuffled(sameType, random),
    ...shuffled(others.filter((v) => !sameType.includes(v)), random),
  ].slice(0, 3);
  if (distractors.length < 3) {
    return { problem: { stationId: authored.id, reason: "fewer than 3 distractor glosses" } };
  }
  const vocabOptions = shuffled([target, ...distractors], random).map((v) => v.definition);

  return {
    station: {
      id: authored.id,
      level: authored.level,
      story: { slug: story.slug, title: story.title },
      clips,
      comprehension: {
        question: authored.comprehension.question,
        options: [...authored.comprehension.options],
        answerIndex: authored.comprehension.answerIndex,
      },
      vocab: {
        word: target.word,
        question: `What does "${target.word}" mean here?`,
        options: vocabOptions,
        answerIndex: vocabOptions.indexOf(target.definition),
      },
    },
  };
}

