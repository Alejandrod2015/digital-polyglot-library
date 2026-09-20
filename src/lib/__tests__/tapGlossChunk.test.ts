import { describe, expect, it } from "vitest";
import { chunkCoversTap } from "../tapGlossChunk";

const p1 = "A la cuarta, él dejó caer una frase mansa, de doble filo.";
const p2 = "“Que le rinda la corona”, se despidió Joaquín, y dejó el doble de propina.";
const chunk = "él dejó caer una frase mansa";

describe("chunkCoversTap", () => {
  it("acepta el trozo en el párrafo donde se escribió", () => {
    expect(chunkCoversTap(chunk, p1)).toBe(true);
    expect(chunkCoversTap(chunk, p1, p1.indexOf("dejó"), 4)).toBe(true);
  });
  it("rechaza el trozo en la otra aparición de la palabra", () => {
    expect(chunkCoversTap(chunk, p2)).toBe(false);
    expect(chunkCoversTap(chunk, p2, p2.indexOf("dejó"), 4)).toBe(false);
  });
  it("con posición, rechaza la aparición del mismo párrafo que el trozo no cubre", () => {
    const p = "Dejó la taza. Luego él dejó caer una frase mansa.";
    expect(chunkCoversTap(chunk, p, 0, 4)).toBe(false);
    expect(chunkCoversTap(chunk, p, p.lastIndexOf("dejó"), 4)).toBe(true);
  });
  it("ignora mayúsculas y comillas tipográficas", () => {
    expect(chunkCoversTap("la mujer que atendía la barra", "Renata, La Mujer Que Atendía La Barra de una cantina")).toBe(true);
    expect(chunkCoversTap("“va que va”", "\"Va que va\", dijo él.")).toBe(true);
  });
  it("sin contexto o sin trozo, no cubre", () => {
    expect(chunkCoversTap(chunk, undefined)).toBe(false);
    expect(chunkCoversTap("", p1)).toBe(false);
  });
});
