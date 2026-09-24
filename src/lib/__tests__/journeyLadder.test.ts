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

  // Cohorte (2026-09-22). El Friends ES Mexico C1 es BORRADOR del molde de
  // siete ciudades; el A0 nuevo es del molde vigente y no debe chocar con el.
  it("un borrador de otra cohorte no sostiene peldano: el A0 mexicano se crea", () => {
    const mxC1: JourneyExistente = {
      id: "cmrrrpru1000032nnzsmraa7h", name: "Friends", language: "spanish", variant: "mexico",
      levels: ["c1"], status: "draft", generationCohort: "cities-2026-07",
    };
    expect(() =>
      assertLadderContiguous({ name: "Friends", language: "spanish", variant: "mexico", levels: ["a0"] }, [mxC1]),
    ).not.toThrow();
  });

  it("LIVE de otra cohorte si sostiene peldano: al alumno le sirve igual", () => {
    const spainA1: JourneyExistente = {
      id: "cmrr5hnbl000032k1esry5n8g", name: "Friends", language: "spanish", variant: "spain",
      levels: ["a1"], status: "active", generationCohort: "cities-2026-07",
    };
    expect(() =>
      assertLadderContiguous({ name: "Friends", language: "spanish", variant: "spain", levels: ["b1"] }, [spainA1]),
    ).toThrow(/A2/);
  });

  it("borrador de la MISMA cohorte sigue contando", () => {
    const mismoMolde: JourneyExistente = {
      id: "otro", name: "Friends", language: "spanish", variant: "mexico",
      levels: ["b1"], status: "draft",
    };
    expect(() =>
      assertLadderContiguous({ name: "Friends", language: "spanish", variant: "mexico", levels: ["a0"] }, [mismoMolde]),
    ).toThrow(/A1, A2/);
  });
});
