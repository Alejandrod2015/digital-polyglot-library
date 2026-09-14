import { describe, it, expect } from "vitest";
import { assertLadderContiguous, type JourneyExistente } from "../journeyLadder";

const FRIENDS_DE_C1: JourneyExistente = {
  id: "cmroo4w4v0000324ow1o9qlcp", name: "Friends", language: "german", variant: "germany", levels: ["c1"], status: "active",
};

describe("assertLadderContiguous", () => {
  it("el Friends DE C1 de test no sostiene la escalera: crear el A0 pasa", () => {
    expect(() =>
      assertLadderContiguous({ name: "Friends", language: "german", variant: "germany", levels: ["a0"] }, [FRIENDS_DE_C1]),
    ).not.toThrow();
  });

  it("sin id, el mismo C1 sigue contando y el A0 falla", () => {
    const { id: _id, ...sinId } = FRIENDS_DE_C1;
    expect(() =>
      assertLadderContiguous({ name: "Friends", language: "german", variant: "germany", levels: ["a0"] }, [sinId]),
    ).toThrow(/hueco/);
  });

  it("cualquier otro hueco sigue fallando: Friends DE B1 con solo el A0", () => {
    const a0: JourneyExistente = { id: "nuevo-a0", name: "Friends", language: "german", variant: "germany", levels: ["a0"], status: "draft" };
    expect(() =>
      assertLadderContiguous({ name: "Friends", language: "german", variant: "germany", levels: ["b1"] }, [FRIENDS_DE_C1, a0]),
    ).toThrow(/A1, A2/);
  });
});
