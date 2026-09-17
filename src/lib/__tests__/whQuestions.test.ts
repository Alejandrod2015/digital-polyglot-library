import { describe, expect, it } from "vitest";

import { isWhQuestion } from "../whQuestions";

describe("isWhQuestion french", () => {
  it("una wh-question no exige subida final", () => {
    expect(isWhQuestion("french", "Où est la bibliothèque près d'ici?")).toBe(true);
  });
  it("una pregunta de sí/no sí la exige", () => {
    expect(isWhQuestion("french", "Tu viens ce soir?")).toBe(false);
  });
  it("qu'est-ce que / combien / quel también cuentan como wh", () => {
    expect(isWhQuestion("french", "Qu'est-ce que tu veux?")).toBe(true);
    expect(isWhQuestion("french", "Combien ça coûte?")).toBe(true);
    expect(isWhQuestion("french", "Quelle heure est-il?")).toBe(true);
  });
});

describe("isWhQuestion otros idiomas (regresión, ya usados por _genPracticeClips.ts)", () => {
  it("español", () => {
    expect(isWhQuestion("spanish", "¿Dónde está el mercado?")).toBe(true);
    expect(isWhQuestion("spanish", "¿Vienes hoy?")).toBe(false);
  });
  it("alemán", () => {
    expect(isWhQuestion("german", "Wo ist die Bibliothek?")).toBe(true);
    expect(isWhQuestion("german", "Kommst du heute?")).toBe(false);
  });
});
