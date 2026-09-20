import { describe, expect, it } from "vitest";
import {
  demonstratedLevelFromStations,
  pickStations,
  placementFromDemonstrated,
  shouldStopLadder,
  stationPassed,
  type LevelTestRung,
  type LevelTestStation,
} from "@domain/levelTest";

const LATAM: LevelTestRung[] = ["A1", "A2", "B1", "B2", "C1"];
const SPAIN: LevelTestRung[] = ["A1", "A2", "B1", "B2"];

describe("demonstratedLevelFromStations", () => {
  it("is A0 when nothing was answered", () => {
    expect(demonstratedLevelFromStations([], LATAM)).toBe("A0");
  });

  it("is A0 when the first rung fails", () => {
    expect(demonstratedLevelFromStations([{ level: "A1", passed: false }], LATAM)).toBe("A0");
  });

  it("is the last rung passed before the first failure", () => {
    expect(
      demonstratedLevelFromStations(
        [
          { level: "A1", passed: true },
          { level: "A2", passed: true },
          { level: "B1", passed: false },
        ],
        LATAM
      )
    ).toBe("A2");
  });

  it("does not count a pass whose rung below failed (one lucky clip is not a level)", () => {
    expect(
      demonstratedLevelFromStations(
        [
          { level: "A1", passed: true },
          { level: "A2", passed: false },
          { level: "B1", passed: true },
        ],
        LATAM
      )
    ).toBe("A1");
  });

  it("forgives one slip low on the ladder when the rungs above confirm each other", () => {
    expect(
      demonstratedLevelFromStations(
        [
          { level: "A1", passed: false },
          { level: "A2", passed: true },
          { level: "B1", passed: true },
          { level: "B2", passed: false },
        ],
        LATAM
      )
    ).toBe("B1");
  });

  it("reaches the top rung when everything passes", () => {
    expect(
      demonstratedLevelFromStations(
        LATAM.map((level) => ({ level, passed: true })),
        LATAM
      )
    ).toBe("C1");
    expect(
      demonstratedLevelFromStations(
        SPAIN.map((level) => ({ level, passed: true })),
        SPAIN
      )
    ).toBe("B2");
  });

  it("needs the rung below to confirm a rung with no result in between", () => {
    expect(
      demonstratedLevelFromStations(
        [
          { level: "A1", passed: true },
          { level: "B1", passed: true },
        ],
        LATAM
      )
    ).toBe("A1");
  });
});

describe("shouldStopLadder", () => {
  it("stops only after two failures in a row", () => {
    expect(shouldStopLadder([])).toBe(false);
    expect(shouldStopLadder([{ level: "A1", passed: false }])).toBe(false);
    expect(
      shouldStopLadder([
        { level: "A1", passed: false },
        { level: "A2", passed: true },
        { level: "B1", passed: false },
      ])
    ).toBe(false);
    expect(
      shouldStopLadder([
        { level: "A1", passed: true },
        { level: "A2", passed: false },
        { level: "B1", passed: false },
      ])
    ).toBe(true);
  });
});

describe("placementFromDemonstrated", () => {
  it("places one rung below, with A0 as the floor", () => {
    expect(placementFromDemonstrated("A0")).toBe("A0");
    expect(placementFromDemonstrated("A1")).toBe("A0");
    expect(placementFromDemonstrated("A2")).toBe("A1");
    expect(placementFromDemonstrated("B1")).toBe("A2");
    expect(placementFromDemonstrated("B2")).toBe("B1");
    expect(placementFromDemonstrated("C1")).toBe("B2");
  });

  it("never places at C1: the ladder has no rung above it", () => {
    const top = demonstratedLevelFromStations(
      LATAM.map((level) => ({ level, passed: true })),
      LATAM
    );
    expect(placementFromDemonstrated(top)).toBe("B2");
  });
});

describe("stationPassed", () => {
  it("needs three of four, and three quarters of any other size", () => {
    expect(stationPassed(3, 4)).toBe(true);
    expect(stationPassed(2, 4)).toBe(false);
    expect(stationPassed(4, 4)).toBe(true);
    expect(stationPassed(2, 3)).toBe(false);
    expect(stationPassed(3, 3)).toBe(true);
    expect(stationPassed(0, 0)).toBe(false);
  });
});

describe("guessing", () => {
  // A station is four exercises with four options each and needs three
  // right, so a guess passes it about 5% of the time, and a rung only
  // counts with the rung below passed too. A guesser is placed at A0 about
  // 98% of the time and above A1 well under 1%. The old test sent 47% of
  // guessers to A2.
  it("sends almost every guesser to A0", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const runs = 20000;
    const placed: Record<string, number> = {};
    for (let i = 0; i < runs; i++) {
      const results: { level: LevelTestRung; passed: boolean }[] = [];
      for (const level of LATAM) {
        let right = 0;
        for (let k = 0; k < 4; k++) if (random() < 1 / 4) right++;
        results.push({ level, passed: stationPassed(right, 4) });
        if (shouldStopLadder(results)) break;
      }
      const placement = placementFromDemonstrated(demonstratedLevelFromStations(results, LATAM));
      placed[placement] = (placed[placement] ?? 0) + 1;
    }
    expect((placed.A0 ?? 0) / runs).toBeGreaterThan(0.95);
    expect(((placed.A2 ?? 0) + (placed.B1 ?? 0) + (placed.B2 ?? 0)) / runs).toBeLessThan(0.01);
  });
});

describe("pickStations", () => {
  const station = (id: string, level: LevelTestRung): LevelTestStation => ({
    id,
    level,
    story: { slug: id, title: id },
    exercises: [],
  });

  it("takes one station per rung, in ladder order, chosen by the random source", () => {
    const stations = [
      station("a1-x", "A1"),
      station("a1-y", "A1"),
      station("a2-x", "A2"),
      station("b1-x", "B1"),
    ];
    const first = pickStations({ ladder: ["A1", "A2", "B1"], stations }, () => 0);
    expect(first.map((s) => s.id)).toEqual(["a1-x", "a2-x", "b1-x"]);
    const last = pickStations({ ladder: ["A1", "A2", "B1"], stations }, () => 0.99);
    expect(last.map((s) => s.id)).toEqual(["a1-y", "a2-x", "b1-x"]);
  });

  it("drops rungs that have no station instead of failing", () => {
    const stations = [station("a1-x", "A1"), station("b1-x", "B1")];
    const picked = pickStations({ ladder: ["A1", "A2", "B1"], stations }, () => 0);
    expect(picked.map((s) => s.level)).toEqual(["A1", "B1"]);
  });
});
