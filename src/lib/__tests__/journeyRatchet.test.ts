import { describe, expect, it } from "vitest";
import { empeora } from "../../../scripts/journeyRatchet";
import type { JourneyCheck } from "@/lib/validateJourneyStories";

// El trinquete de --no-regression en saveStory.ts. Caso real que lo motivo
// (2026-09-11): el Traveler PT-BR B1 subio el suelo de nivel de 0/420 a
// 26/420 y el trinquete lo leyo como EMPEORA.

const fallo = (detail: string, magnitud?: JourneyCheck["magnitud"]): JourneyCheck => ({
  id: "x", label: "x", status: "fail", detail, magnitud,
});

describe("empeora: regla con magnitud declarada", () => {
  const suelo = (n: number) =>
    fallo(`${n}/420 plazas por encima de A1/A2 (${Math.round((n / 420) * 100)}%, suelo 60%)`,
      { valor: n / 420, mejor: "alta" });

  it("suelo de nivel de 0% a 6% es mejora", () => {
    expect(empeora(suelo(0), suelo(26), [])).toBe(false);
  });

  it("suelo de nivel de 6% a 0% es empeoramiento", () => {
    expect(empeora(suelo(26), suelo(0), [])).toBe(true);
  });

  it("el mismo valor no empeora", () => {
    expect(empeora(suelo(26), suelo(26), [])).toBe(false);
  });

  it("mejor baja: bajar la media es mejorar, subirla es empeorar", () => {
    const m = (v: number) => fallo(`media ${v}`, { valor: v, mejor: "baja" });
    expect(empeora(m(2.48), m(2.1), [])).toBe(false);
    expect(empeora(m(2.1), m(2.48), [])).toBe(true);
  });

  it("recirculacion: subir la media es mejora aunque el detalle diga 'media N'", () => {
    const r = (v: number) => fallo(`media ${v.toFixed(2)} encuentros por plaza`, { valor: v, mejor: "alta" });
    expect(empeora(r(2.1), r(2.8), [])).toBe(false);
    expect(empeora(r(2.8), r(2.1), [])).toBe(true);
  });

  it("varias dimensiones: empeora si empeora cualquiera", () => {
    const r = (media: number, cuota: number, cola: number) => fallo("portables", [
      { valor: media, mejor: "alta" }, { valor: cuota, mejor: "baja" }, { valor: cola, mejor: "baja" },
    ]);
    expect(empeora(r(2.1, 0.2, 0.3), r(2.5, 0.2, 0.25), [])).toBe(false);
    expect(empeora(r(2.1, 0.2, 0.3), r(2.5, 0.25, 0.25), [])).toBe(true);
  });

  it("antes pasaba y ahora no: empeora aunque haya magnitud", () => {
    const antes: JourneyCheck = { id: "x", label: "x", status: "pass", magnitud: { valor: 0.7, mejor: "alta" } };
    expect(empeora(antes, suelo(300), [])).toBe(true);
  });

  it("dimensiones distintas entre antes y ahora: no comparables, cae a la regla vieja", () => {
    const a = fallo("a", { valor: 1, mejor: "alta" });
    const h = fallo("b", [{ valor: 2, mejor: "alta" }, { valor: 0, mejor: "baja" }]);
    expect(empeora(a, h, [])).toBe(true);
  });
});

describe("empeora: regla sin magnitud conserva el comportamiento de siempre", () => {
  const slugs = ["uno", "dos", "tres"];

  it("sin medicion previa: empeora", () => {
    expect(empeora(undefined, fallo("uno"), slugs)).toBe(true);
  });

  it("detalle identico: igual", () => {
    expect(empeora(fallo("1/3 fuera: uno 40%"), fallo("1/3 fuera: uno 40%"), slugs)).toBe(false);
  });

  it("los slugs de ahora son subconjunto de los de antes: igual o mejor", () => {
    expect(empeora(fallo("2/3 fuera: uno, dos"), fallo("1/3 fuera: dos"), slugs)).toBe(false);
  });

  it("aparece un slug nuevo: empeora", () => {
    expect(empeora(fallo("1/3 fuera: uno"), fallo("1/3 fuera: tres"), slugs)).toBe(true);
  });

  it("el detalle cambia y no cita slugs: empeora", () => {
    expect(empeora(fallo("4 fijos: Ana, Bea"), fallo("3 fijos: Ana"), slugs)).toBe(true);
  });

  it("respaldo 'media N' del detalle: bajar es mejorar", () => {
    expect(empeora(fallo("media 2,48 plazas"), fallo("media 2,10 plazas"), slugs)).toBe(false);
    expect(empeora(fallo("media 2,10 plazas"), fallo("media 2,48 plazas"), slugs)).toBe(true);
  });
});
