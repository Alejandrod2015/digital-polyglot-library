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

import { chunkForTap, glossOccurrences, uncoveredOccurrences } from "../tapGlossChunk";

describe("chunkForTap y las apariciones", () => {
  const texto = `${p1}\n${p2}`;
  const c = { es: chunk, en: "he let a harmless phrase drop" };
  const c2 = { es: "dejó el doble de propina", en: "left double the tip" };

  it("encuentra las dos apariciones de la palabra", () => {
    expect(glossOccurrences("dejó", texto).map((o) => o.at)).toEqual([p1.indexOf("dejó"), p1.length + 1 + p2.indexOf("dejó")]);
  });
  it("con un solo trozo, la segunda aparición queda sin cubrir", () => {
    expect(uncoveredOccurrences("dejó", texto, { c })).toHaveLength(1);
    expect(uncoveredOccurrences("dejó", texto, { c, cs: [c2] })).toHaveLength(0);
  });
  it("elige el trozo que cubre la posición tocada", () => {
    expect(chunkForTap({ c, cs: [c2] }, p2, p2.indexOf("dejó"), 4)).toBe(c2);
    expect(chunkForTap({ c, cs: [c2] }, p1, p1.indexOf("dejó"), 4)).toBe(c);
    expect(chunkForTap({ c }, p2, p2.indexOf("dejó"), 4)).toBeUndefined();
  });
  it("no confunde la palabra con otra que la contiene", () => {
    expect(glossOccurrences("que", "Aquel queso que quedó.")).toHaveLength(1);
  });
});

describe("verbos separables con puntos suspensivos", () => {
  const de = "Er holt seine Tochter vom Bahnhof ab. Dann holt er Brot.";
  it("cubre las dos mitades y lo que hay en medio", () => {
    expect(chunkCoversTap("holt … ab", de, de.indexOf("holt"), 4)).toBe(true);
    expect(chunkCoversTap("holt … ab", de, de.indexOf("ab."), 2)).toBe(true);
  });
  it("no cubre el segundo holt, que va sin ab", () => {
    expect(chunkCoversTap("holt … ab", de, de.lastIndexOf("holt"), 4)).toBe(false);
  });
});
