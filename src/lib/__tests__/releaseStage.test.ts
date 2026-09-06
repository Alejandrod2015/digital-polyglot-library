import { describe, expect, it } from "vitest";
import {
  RELEASE_STAGES,
  releaseStageReport,
  stageForDau,
  type ReleaseReadiness,
} from "../releaseStage";

const nothingDone: ReleaseReadiness = { generatedAt: "2026-09-06", status: {} };

function allDone(): ReleaseReadiness {
  const status: Record<string, boolean> = {};
  for (const s of RELEASE_STAGES) for (const it of s.items) if (it.kind !== "process") status[it.id] = true;
  return { generatedAt: "2026-09-06", status };
}

describe("stageForDau", () => {
  it("0 DAU is the baseline, before launch", () => {
    expect(stageForDau(0).n).toBe(0);
  });
  it("1 to 299 DAU is stage 1", () => {
    expect(stageForDau(1).n).toBe(1);
    expect(stageForDau(299).n).toBe(1);
  });
  it("300 opens stage 2 and 3000 opens stage 3", () => {
    expect(stageForDau(300).n).toBe(2);
    expect(stageForDau(2999).n).toBe(2);
    expect(stageForDau(3000).n).toBe(3);
    expect(stageForDau(50000).n).toBe(3);
  });
});

describe("releaseStageReport", () => {
  it("in stage 1 with nothing done, baseline pieces come first and process pieces never show", () => {
    const r = releaseStageReport(40, nothingDone);
    expect(r.current.n).toBe(1);
    expect(r.baselinePending.map((i) => i.id)).toEqual(RELEASE_STAGES[0].items.map((i) => i.id));
    expect(r.currentPending.every((i) => i.kind !== "process")).toBe(true);
    expect(r.next?.n).toBe(2);
    expect(r.dauToNext).toBe(260);
  });
  it("with everything done nothing is pending and the last stage has no next trigger", () => {
    const r = releaseStageReport(5000, allDone());
    expect(r.current.n).toBe(3);
    expect(r.baselinePending).toEqual([]);
    expect(r.currentPending).toEqual([]);
    expect(r.next).toBeNull();
    expect(r.dauToNext).toBe(0);
  });
  it("a piece marked done disappears from pending", () => {
    const r = releaseStageReport(40, { generatedAt: "2026-09-06", status: { "mobile-sentry": true } });
    expect(r.baselinePending.map((i) => i.id)).not.toContain("mobile-sentry");
  });
});

describe("plan integrity", () => {
  it("piece ids are unique across stages", () => {
    const ids = RELEASE_STAGES.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("stages are ordered by minDau", () => {
    const mins = RELEASE_STAGES.map((s) => s.minDau);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
  });
});
