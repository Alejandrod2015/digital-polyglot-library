import { describe, it, expect } from "vitest";
import { fueraDelIdioma } from "../nameSpeakability";
import { getNameBank } from "../characterNames";

const mx = getNameBank("spanish", "mexico")!;

describe("fueraDelIdioma", () => {
  it("caza los dos que rompieron el audio del Friends ES Mexico A0", () => {
    // Itzel es maya y Citlali nahuatl: se usan en Mexico, no son espanoles.
    const cast = ["Bruno", "Itzel", "Arturo", "Citlali", "Valeria"];
    expect(fueraDelIdioma(cast, mx, "spanish")).toEqual(["Itzel", "Citlali"]);
  });

  it("deja pasar un reparto entero sacado del banco", () => {
    const cast = ["Valeria", "Mauricio", "Fernanda", "Omar", "Diego", "Ximena"];
    expect(fueraDelIdioma(cast, mx, "spanish")).toEqual([]);
  });

  it("no marca a los de generacion mayor, que tambien son del idioma", () => {
    expect(fueraDelIdioma(["Guadalupe", "Alfonso"], mx, "spanish")).toEqual([]);
  });

  it("no repite un nombre que aparece varias veces", () => {
    expect(fueraDelIdioma(["Itzel", "Itzel", "ITZEL"], mx, "spanish")).toHaveLength(1);
  });

  it("respeta lo que el usuario aprobo de oido", () => {
    const banco = { young: [...mx.young, "Itzel"], older: mx.older };
    expect(fueraDelIdioma(["Itzel"], banco, "spanish")).toEqual([]);
  });

  it("no se inventa nada con un reparto vacio", () => {
    expect(fueraDelIdioma([], mx, "spanish")).toEqual([]);
  });
});
