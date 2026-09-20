import { describe, expect, it } from "vitest";
import { resolveStation } from "@/lib/levelTest/resolveStation";
import type { AuthoredStation } from "@/lib/levelTest/stations.es";

const authored: AuthoredStation = {
  id: "es-test-a1",
  level: "A1",
  storySlug: "la-barra-manda",
  fragments: [1, 2],
  comprehension: {
    question: "Why?",
    options: ["a", "b", "c"],
    answerIndex: 1,
  },
  vocabWord: "Carta",
};

const story = {
  slug: "la-barra-manda",
  title: "La barra manda",
  audioFragments: [
    { url: "u0", text: "Título.", index: 0, startSec: 0, endSec: 1 },
    { url: "u1", text: "Irene espera la carta un buen rato.", index: 1, startSec: 2, endSec: 8.5 },
    { url: "u2", text: "Aquí no hay carta, guapa.", index: 2, startSec: 9, endSec: 14 },
  ],
  vocab: [
    { word: "carta", definition: "Menu; the printed list of dishes.", type: "noun" },
    { word: "barra", definition: "Bar counter.", type: "noun" },
    { word: "dueño", definition: "Owner.", type: "noun" },
    { word: "guapa", definition: "Love; a friendly word.", type: "noun" },
    { word: "lleno", definition: "Full.", type: "adjective" },
    { word: "secar", definition: "Dries; passes a cloth over it.", type: "verb" },
  ],
};

describe("resolveStation", () => {
  it("builds the clips from the named fragments and the vocab question from the story's glosses", () => {
    const result = resolveStation(authored, story);
    if ("problem" in result) throw new Error(result.problem.reason);
    const { station } = result;
    expect(station.clips.map((c) => c.url)).toEqual(["u1", "u2"]);
    expect(station.clips[0].durationSec).toBeCloseTo(6.5);
    expect(station.vocab.word).toBe("carta");
    expect(station.vocab.options).toHaveLength(4);
    expect(station.vocab.options[station.vocab.answerIndex]).toBe("Menu; the printed list of dishes.");
    expect(new Set(station.vocab.options).size).toBe(4);
    expect(station.comprehension.answerIndex).toBe(1);
  });

  it("prefers distractors of the same part of speech", () => {
    const result = resolveStation(authored, story);
    if ("problem" in result) throw new Error(result.problem.reason);
    expect(result.station.vocab.options).not.toContain("Full.");
    expect(result.station.vocab.options).not.toContain("Dries; passes a cloth over it.");
  });

  it("is deterministic per station id", () => {
    const a = resolveStation(authored, story);
    const b = resolveStation(authored, story);
    expect(a).toEqual(b);
  });

  it("reports a missing fragment", () => {
    const result = resolveStation({ ...authored, fragments: [1, 7] }, story);
    expect("problem" in result && result.problem.reason).toMatch(/fragment 7/);
  });

  it("reports a vocab word that is not in the clip", () => {
    const result = resolveStation({ ...authored, vocabWord: "dueño" }, story);
    expect("problem" in result && result.problem.reason).toMatch(/not in clip/);
  });

  it("reports a vocab word the story does not gloss", () => {
    const result = resolveStation({ ...authored, vocabWord: "rato" }, story);
    expect("problem" in result && result.problem.reason).toMatch(/not in story/);
  });

  it("needs three other glosses for the distractors", () => {
    const result = resolveStation(authored, { ...story, vocab: story.vocab.slice(0, 3) });
    expect("problem" in result && result.problem.reason).toMatch(/distractor/);
  });
});
