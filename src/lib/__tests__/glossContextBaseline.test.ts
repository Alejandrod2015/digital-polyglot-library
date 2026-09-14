import { describe, expect, it } from "vitest";
import { apretarLineaBase, compararConLineaBase } from "@/lib/glossContextBaseline";

describe("compararConLineaBase", () => {
  it("distingue un hueco nuevo de deuda vieja ya congelada", () => {
    const baseline = { "bundle-x": ["historia-a|palabra1", "historia-a|palabra2"] };
    const actual = new Set(["historia-a|palabra1", "historia-b|palabra3"]);
    const { nuevos, viejos } = compararConLineaBase("bundle-x", actual, baseline);
    expect(viejos).toEqual(["historia-a|palabra1"]);
    expect(nuevos).toEqual(["historia-b|palabra3"]);
  });

  it("un bundle sin linea base sale a cero: toda entrada mala es nueva", () => {
    const actual = new Set(["historia-a|palabra1"]);
    const { nuevos, viejos } = compararConLineaBase("bundle-nuevo", actual, {});
    expect(nuevos).toEqual(["historia-a|palabra1"]);
    expect(viejos).toEqual([]);
  });

  it("el mismo total con conjuntos distintos no se confunde: una vieja arreglada y una nueva rota siguen contando como nueva", () => {
    const baseline = { "bundle-x": ["historia-a|palabra1"] };
    const actual = new Set(["historia-b|palabra9"]); // palabra1 se arreglo, palabra9 es nueva
    const { nuevos, viejos } = compararConLineaBase("bundle-x", actual, baseline);
    expect(nuevos).toEqual(["historia-b|palabra9"]);
    expect(viejos).toEqual([]);
  });
});

describe("apretarLineaBase", () => {
  it("escribe lo medido hoy, sin los bundles excluidos", () => {
    const medido = {
      "bundle-x": new Set(["a|1", "a|2"]),
      "french-friends-france-b1": new Set(["z|9"]),
      "bundle-limpio": new Set<string>(),
    };
    const nueva = apretarLineaBase(medido, new Set(["french-friends-france-b1"]));
    expect(nueva).toEqual({ "bundle-x": ["a|1", "a|2"] });
  });
});
