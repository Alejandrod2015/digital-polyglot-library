import { describe, it, expect } from "vitest";
import { validateJourneyStories, type JourneyStoryInput } from "../validateJourneyStories";

const historias = (language: string): JourneyStoryInput[] =>
  Array.from({ length: 7 }, (_, i) => ({
    slug: `h${i}`, title: `H${i}`, language, level: "a0", topic: `t${i}`,
    text: `Anna sitzt in der Küche. “Hallo”, sagt Anna.`,
    vocab: [{ word: "die Küche", surface: "Küche" }, { word: "sitzen", surface: "sitzt" }],
  }));

const worth = (language: string, journeyType: string) =>
  validateJourneyStories(historias(language), { language, level: "a0", conjuntoCompleto: true, journeyType })
    .find((c) => c.id === "journey-vocab-worth-teaching");

describe("journey-vocab-worth-teaching", () => {
  it("un Friends aleman pasa e informa del motivo", () => {
    const c = worth("DE", "relationships");
    expect(c?.status).toBe("pass");
    expect(c?.detail).toMatch(/sin lexico graduado para DE/);
  });

  it("un Traveler aleman sigue sin implementar", () => {
    expect(worth("DE", "traveler")?.status).toBe("not-implemented");
  });

  it("sin tipo, un aleman sigue sin implementar", () => {
    expect(worth("DE", "")?.status).toBe("not-implemented");
  });

  it("un Friends espanol sigue midiendo como antes", () => {
    const c = worth("ES", "relationships");
    expect(c?.status).toBe("pass");
    expect(c?.detail ?? "").not.toMatch(/sin lexico graduado/);
    expect(c?.magnitud).toBeDefined();
  });
});
