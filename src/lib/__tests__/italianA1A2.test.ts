import { describe, expect, it } from "vitest";
import { isItalianA1A2 } from "../cefr/italianA1A2";

describe("italianA1A2: bloque curado con nivel KELLY por palabra", () => {
  it("acepta las basicas que faltaban en el bloque 1", () => {
    for (const w of ["nome", "chiave", "euro", "dividere", "restare", "il conto"]) {
      expect(isItalianA1A2(w)).toBe(true);
    }
  });
  it("acepta el plural en -i de un nombre en -e", () => {
    expect(isItalianA1A2("chiavi")).toBe(true);
  });
  it("deja fuera lo que KELLY marca B1 o mas y el sentido que no es A1", () => {
    for (const w of ["costoso", "risparmiare", "rumore", "straordinario"]) {
      expect(isItalianA1A2(w)).toBe(false);
    }
  });
});
