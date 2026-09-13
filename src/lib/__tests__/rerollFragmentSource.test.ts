import { describe, expect, it } from "vitest";

import { rerollFragmentSource } from "../rerollFragmentSource";

const frags = [
  { index: 0, text: "Le titre" },
  { index: 1, text: "Premier paragraphe." },
  { index: 2, text: "Deuxième paragraphe." },
  { index: 3, text: "Troisième paragraphe." },
];
const text = "Premier paragraphe.\n\nDeuxième paragraphe.\n\nTroisième paragraphe.";

describe("rerollFragmentSource", () => {
  it("el fragmento 0 sale del titulo", () => {
    expect(rerollFragmentSource({ title: "Nouveau titre", text, fragments: frags, index: 0 }))
      .toEqual({ source: "Nouveau titre", stored: "Le titre", changed: true });
  });

  it("un parrafo corregido se narra desde story.text, no desde el fragmento", () => {
    const nuevo = text.replace("Troisième paragraphe.", "Troisième paragraphe, corrigé.");
    expect(rerollFragmentSource({ title: "Le titre", text: nuevo, fragments: frags, index: 3 }))
      .toEqual({ source: "Troisième paragraphe, corrigé.", stored: "Troisième paragraphe.", changed: true });
  });

  it("sin cambios devuelve el mismo texto y changed false", () => {
    expect(rerollFragmentSource({ title: "Le titre", text, fragments: frags, index: 2 }).changed).toBe(false);
  });

  it("tira si el numero de parrafos no coincide", () => {
    expect(() => rerollFragmentSource({ title: "Le titre", text: `${text}\n\nQuatrième.`, fragments: frags, index: 2 }))
      .toThrow(/NO CASA/);
  });

  it("tira si cambia mas de la mitad del texto", () => {
    expect(() => rerollFragmentSource({ title: "Le titre", text: "A.\n\nB.\n\nTroisième paragraphe.", fragments: frags, index: 1 }))
      .toThrow(/NO CASA/);
  });

  it("tira si los indices del cuerpo no son seguidos", () => {
    const huecos = [frags[0], frags[1], { index: 3, text: "Deuxième paragraphe." }, { index: 4, text: "Troisième paragraphe." }];
    expect(() => rerollFragmentSource({ title: "Le titre", text, fragments: huecos, index: 1 })).toThrow(/NO CASA/);
  });
});
