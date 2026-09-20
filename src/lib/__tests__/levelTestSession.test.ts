import { describe, expect, it } from "vitest";
import type { LevelTestPayload, LevelTestRung, LevelTestStation } from "@domain/levelTest";
import {
  LEVEL_TEST_INITIAL_STATE,
  canReplay,
  currentQuestion,
  levelTestOutcome,
  levelTestSessionReducer as reduce,
  questionsVisible,
  type LevelTestSessionAction,
  type LevelTestSessionState,
} from "@domain/levelTestSession";

const station = (level: LevelTestRung): LevelTestStation => ({
  id: `s-${level}`,
  level,
  story: { slug: level, title: level },
  clips: [{ url: "u", text: "t", durationSec: 10 }],
  comprehension: { question: "c?", options: ["a", "b", "c"], answerIndex: 1 },
  vocab: { word: "w", question: "v?", options: ["a", "b", "c", "d"], answerIndex: 2 },
});

const payload: LevelTestPayload = {
  language: "Spanish",
  variant: "latam",
  ladder: ["A1", "A2", "B1", "B2", "C1"],
  stations: ["A1", "A2", "B1", "B2", "C1"].map((l) => station(l as LevelTestRung)),
};

function run(actions: LevelTestSessionAction[], from = LEVEL_TEST_INITIAL_STATE): LevelTestSessionState {
  return actions.reduce(reduce, from);
}

/** Play the current station's clip and answer it right or wrong. */
function answerStation(right: boolean): LevelTestSessionAction[] {
  return [
    { type: "audioStarted" },
    { type: "audioDone" },
    { type: "select", index: right ? 1 : 0 },
    { type: "submit" },
    { type: "select", index: right ? 2 : 0 },
    { type: "submit" },
  ];
}

describe("levelTestSessionReducer", () => {
  it("goes loading > intro on a payload and > error on a failure or an empty payload", () => {
    expect(run([{ type: "loaded", payload }]).phase).toBe("intro");
    expect(run([{ type: "loadFailed" }]).phase).toBe("error");
    expect(run([{ type: "loaded", payload: { ...payload, stations: [] } }]).phase).toBe("error");
  });

  it("hides the questions until the clip ends, and shows them if the clip fails", () => {
    const started = run([{ type: "loaded", payload }, { type: "start" }, { type: "audioStarted" }]);
    expect(started.phase).toBe("station");
    expect(questionsVisible(started)).toBe(false);
    expect(reduce(started, { type: "select", index: 1 }).selected).toBeNull();
    expect(questionsVisible(reduce(started, { type: "audioDone" }))).toBe(true);
    expect(questionsVisible(reduce(started, { type: "audioFailed" }))).toBe(true);
  });

  it("allows exactly one replay, never while playing", () => {
    const done = run([{ type: "loaded", payload }, { type: "start" }, { type: "audioDone" }]);
    expect(canReplay(done)).toBe(true);
    const replayed = reduce(done, { type: "replay" });
    expect(replayed.audio).toBe("playing");
    expect(canReplay(replayed)).toBe(false);
    const doneAgain = reduce(replayed, { type: "audioDone" });
    expect(canReplay(doneAgain)).toBe(false);
    expect(reduce(doneAgain, { type: "replay" })).toBe(doneAgain);
  });

  it("needs a selection to submit and moves from comprehension to vocabulary", () => {
    const s = run([{ type: "loaded", payload }, { type: "start" }, { type: "audioDone" }]);
    expect(reduce(s, { type: "submit" })).toBe(s);
    const after = run([{ type: "select", index: 1 }, { type: "submit" }], s);
    expect(after.questionIndex).toBe(1);
    expect(after.comprehensionRight).toBe(true);
    expect(after.selected).toBeNull();
    expect(currentQuestion(after)?.question).toBe("v?");
  });

  it("climbs while both answers are right and places one rung below the top", () => {
    let s = run([{ type: "loaded", payload }, { type: "start" }]);
    for (let i = 0; i < 5; i++) s = run(answerStation(true), s);
    expect(s.phase).toBe("result");
    expect(s.results.map((r) => r.passed)).toEqual([true, true, true, true, true]);
    const out = levelTestOutcome(s, "onboarding");
    expect(out).toMatchObject({ level: "B2", demonstrated: "C1", correct: 10, total: 10, skipped: false });
    expect(levelTestOutcome(s, "locked-story").level).toBe("C1");
  });

  it("stops after two failures in a row and forgives a single slip", () => {
    let s = run([{ type: "loaded", payload }, { type: "start" }]);
    s = run(answerStation(true), s); // A1
    s = run(answerStation(false), s); // A2 slip
    expect(s.phase).toBe("station");
    expect(s.stationIndex).toBe(2);
    s = run(answerStation(true), s); // B1
    s = run(answerStation(true), s); // B2
    s = run(answerStation(false), s); // C1
    expect(s.phase).toBe("result");
    expect(levelTestOutcome(s, "onboarding")).toMatchObject({ demonstrated: "B2", level: "B1" });

    let t = run([{ type: "loaded", payload }, { type: "start" }]);
    t = run(answerStation(true), t); // A1
    t = run(answerStation(false), t); // A2
    t = run(answerStation(false), t); // B1: second failure in a row
    expect(t.phase).toBe("result");
    expect(t.results).toHaveLength(3);
    expect(levelTestOutcome(t, "onboarding")).toMatchObject({ demonstrated: "A1", level: "A0" });
  });

  it("a station with one wrong answer is not passed", () => {
    let s = run([{ type: "loaded", payload }, { type: "start" }, { type: "audioDone" }]);
    s = run([{ type: "select", index: 1 }, { type: "submit" }, { type: "select", index: 0 }, { type: "submit" }], s);
    expect(s.results[0]).toEqual({ level: "A1", passed: false });
    expect(s.correct).toBe(1);
    expect(s.answered).toBe(2);
  });

  it("resets the per-station state when moving to the next rung", () => {
    let s = run([{ type: "loaded", payload }, { type: "start" }, { type: "audioDone" }, { type: "replay" }]);
    s = run([{ type: "audioDone" }, { type: "select", index: 1 }, { type: "submit" }, { type: "select", index: 2 }, { type: "submit" }], s);
    expect(s.stationIndex).toBe(1);
    expect(s.audio).toBe("idle");
    expect(s.replaysLeft).toBe(1);
    expect(s.questionIndex).toBe(0);
    expect(s.selected).toBeNull();
  });

  it("'I'm brand new' skips straight to an A0 result from the intro or the error screen", () => {
    const fromIntro = run([{ type: "loaded", payload }, { type: "skipBrandNew" }]);
    expect(fromIntro.phase).toBe("result");
    expect(levelTestOutcome(fromIntro, "onboarding")).toMatchObject({ level: "A0", demonstrated: "A0", skipped: true, total: 0 });
    const fromError = run([{ type: "loadFailed" }, { type: "skipBrandNew" }]);
    expect(levelTestOutcome(fromError, "onboarding").level).toBe("A0");
    const midTest = run([{ type: "loaded", payload }, { type: "start" }, { type: "skipBrandNew" }]);
    expect(midTest.phase).toBe("station");
  });

  it("reset returns to loading from anywhere", () => {
    const s = run([{ type: "loaded", payload }, { type: "start" }, { type: "audioDone" }]);
    expect(reduce(s, { type: "reset" })).toBe(LEVEL_TEST_INITIAL_STATE);
  });

  it("ignores out-of-range selections and actions outside their phase", () => {
    const intro = run([{ type: "loaded", payload }]);
    expect(reduce(intro, { type: "select", index: 0 })).toBe(intro);
    expect(reduce(intro, { type: "audioDone" })).toBe(intro);
    const s = run([{ type: "start" }, { type: "audioDone" }], intro);
    expect(reduce(s, { type: "select", index: 9 })).toBe(s);
  });
});
