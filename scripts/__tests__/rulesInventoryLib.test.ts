import { describe, it, expect } from "vitest";
import { idsDeChecksEnTexto } from "../rulesInventoryLib";

describe("idsDeChecksEnTexto", () => {
  it("no toma flags.push(\"imperfetto\") por un check nuevo", () => {
    const txt = `
      export function validateJourneyStories() {
        const flags: string[] = [];
        flags.push("imperfetto");
        push("journey-a0-floor", "Suelo A0", true, "detalle");
      }
    `;
    const ids = idsDeChecksEnTexto(txt);
    expect(ids).not.toContain("imperfetto");
    expect(ids).toContain("journey-a0-floor");
  });

  it("sigue detectando un check nuevo de verdad (push suelto, noImplSet y id: de objeto)", () => {
    const txt = `
      export function validateJourneyStories() {
        push("journey-nueva-regla", "Una regla nueva", true, "detalle");
        noImplSet("journey-otra-regla", "Otra", "sin implementar");
        const check = { id: "journey-tercera-regla", label: "Tercera" };
      }
    `;
    const ids = idsDeChecksEnTexto(txt);
    expect(ids).toContain("journey-nueva-regla");
    expect(ids).toContain("journey-otra-regla");
    expect(ids).toContain("journey-tercera-regla");
  });
});
