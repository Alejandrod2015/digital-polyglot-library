import { describe, expect, it } from "vitest";
import {
  BETA_GRACE_END_MS,
  WALL_CUTOFF_MS,
  canAccessStoryContent,
  resolveEffectivePlan,
} from "@domain/access";

const DAY = 24 * 60 * 60 * 1000;
const preWallAccount = WALL_CUTOFF_MS - 30 * DAY;
const postWallAccount = WALL_CUTOFF_MS + DAY;
const duringGrace = WALL_CUTOFF_MS + 10 * DAY;
const afterGrace = BETA_GRACE_END_MS + DAY;

describe("resolveEffectivePlan (muro 2026-09)", () => {
  it("visitante sin cuenta es free", () => {
    expect(resolveEffectivePlan({ plan: undefined, isSignedIn: false })).toBe("free");
  });

  it("cuenta nueva sin pagar es basic", () => {
    expect(
      resolveEffectivePlan({
        plan: "free",
        isSignedIn: true,
        userCreatedAtMs: postWallAccount,
        nowMs: duringGrace,
      })
    ).toBe("basic");
  });

  it("cuenta beta (pre-muro) navega como premium durante la gracia", () => {
    expect(
      resolveEffectivePlan({
        plan: "free",
        isSignedIn: true,
        userCreatedAtMs: preWallAccount,
        nowMs: duringGrace,
      })
    ).toBe("premium");
  });

  it("la gracia beta caduca el 2027-03-31 y cae a basic", () => {
    expect(
      resolveEffectivePlan({
        plan: "free",
        isSignedIn: true,
        userCreatedAtMs: preWallAccount,
        nowMs: afterGrace,
      })
    ).toBe("basic");
  });

  it("los planes de pago pasan tal cual", () => {
    expect(
      resolveEffectivePlan({
        plan: "polyglot",
        isSignedIn: true,
        userCreatedAtMs: preWallAccount,
        nowMs: afterGrace,
      })
    ).toBe("polyglot");
    expect(
      resolveEffectivePlan({
        plan: "premium",
        isSignedIn: true,
        userCreatedAtMs: postWallAccount,
        nowMs: duringGrace,
      })
    ).toBe("premium");
  });

  it("sin fecha de creacion no hay gracia", () => {
    expect(
      resolveEffectivePlan({
        plan: "free",
        isSignedIn: true,
        userCreatedAtMs: null,
        nowMs: duringGrace,
      })
    ).toBe("basic");
  });
});

describe("canAccessStoryContent (muro 2026-09)", () => {
  it("free solo lee la historia del dia", () => {
    expect(canAccessStoryContent({ plan: "free", isDailyStory: true })).toBe(true);
    expect(canAccessStoryContent({ plan: "free", isFirstTopicStory: true })).toBe(false);
    expect(canAccessStoryContent({ plan: "free" })).toBe(false);
  });

  it("basic lee el tema 1 y la historia del dia", () => {
    expect(canAccessStoryContent({ plan: "basic", isFirstTopicStory: true })).toBe(true);
    expect(canAccessStoryContent({ plan: "basic", isDailyStory: true })).toBe(true);
    expect(canAccessStoryContent({ plan: "basic" })).toBe(false);
  });

  it("premium lee todo; un libro comprado se lee sin plan", () => {
    expect(canAccessStoryContent({ plan: "premium" })).toBe(true);
    expect(canAccessStoryContent({ plan: "free", ownsBook: true })).toBe(true);
  });
});
