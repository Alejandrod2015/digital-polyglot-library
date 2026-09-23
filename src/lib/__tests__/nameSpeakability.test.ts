import { describe, it, expect } from "vitest";
import { nombresDificiles } from "../nameSpeakability";

describe("nombresDificiles", () => {
  it("caza los dos que rompieron el audio del Friends ES Mexico A0", () => {
    const fuera = nombresDificiles(["Bruno", "Itzel", "Arturo", "Citlali"], "spanish");
    expect(fuera.map((f) => f.nombre)).toEqual(["Itzel", "Citlali"]);
  });

  it("deja pasar Ximena, que la voz si sabe decir", () => {
    // Su "x" se lee como la jota castellana, aprendida de "Mexico" y "Javier".
    expect(nombresDificiles(["Ximena", "Jimena", "Xochilt".slice(0, 4)], "spanish")).toEqual([]);
  });

  it("deja pasar el reparto entero de un journey sano", () => {
    const cast = ["Valeria", "Mauricio", "Fernanda", "Omar", "Diego", "Emiliano"];
    expect(nombresDificiles(cast, "spanish")).toEqual([]);
  });

  it("no repite un nombre que aparece varias veces", () => {
    expect(nombresDificiles(["Itzel", "Itzel", "ITZEL"], "spanish")).toHaveLength(1);
  });

  it("respeta lo que el usuario aprobo de oido", () => {
    expect(nombresDificiles(["Itzel"], "spanish", ["Itzel"])).toEqual([]);
  });

  it("no opina sobre un idioma sin reglas", () => {
    expect(nombresDificiles(["Itzel"], "korean")).toEqual([]);
    expect(nombresDificiles(["Itzel"], null)).toEqual([]);
  });
});
