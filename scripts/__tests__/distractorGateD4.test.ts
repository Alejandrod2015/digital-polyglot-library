/**
 * D4: el par de antonimos de VARIAS PALABRAS.
 *
 * Los cuatro primeros casos son reales, encontrados a mano DESPUES de que el
 * gate saliera en verde (2026-09-23 y 2026-09-24). Los negativos son la otra
 * mitad del trabajo: un gate que canta sobre cualquier par que comparta una
 * palabra es peor que el agujero.
 */
import { describe, it, expect } from "vitest";
import { distractorIssues } from "../distractorGate";

const meaning = (word: string, answer: string, options: string[]) => ({
  type: "meaning_in_context",
  word,
  sentence: `... ${word} ...`,
  payload: { answer, options },
});

const fill = (word: string, answer: string, options: string[], optionTranslations?: string[]) => ({
  type: "fill_blank",
  word,
  sentence: `Mariana _____ en la mesa.`,
  payload: { answer, options, ...(optionTranslations ? { optionTranslations } : {}) },
});

const es = { language: "spanish" };
const d4 = (ex: any, ctx: any = es) => distractorIssues(ex, ctx).issues.filter((i) => i.includes("D4"));
const noD4 = (ex: any, ctx: any = es) => expect(d4(ex, ctx)).toEqual([]);

describe("D4 con pares de varias palabras", () => {
  it("caso real: 'me too' contra 'not me' (Conversations ES latam A0)", () => {
    const ex = meaning("Yo tambien", "me too", ["me too", "not me", "every week", "of course"]);
    expect(d4(ex)).toHaveLength(1);
    expect(d4(ex)[0]).toContain("not me");
  });

  it("caso real: 'papel cae' contra 'costo sube' (Friends ES Colombia A0)", () => {
    const ex = fill("papel cae", "papel cae", ["papel cae", "costo sube", "bolsa llega", "vaso canta"]);
    expect(d4(ex)).toHaveLength(1);
  });

  it("caso real: 'mirada suave' contra 'voz fuerte'", () => {
    const ex = fill("mirada suave", "mirada suave", ["mirada suave", "voz fuerte", "mano abierta", "paso corto"]);
    expect(d4(ex)).toHaveLength(1);
  });

  it("caso real: 'guarda vuelto' contra 'pide plata'", () => {
    const ex = fill("guarda vuelto", "guarda vuelto", ["guarda vuelto", "pide plata", "abre puertas", "canta bajo"]);
    expect(d4(ex)).toHaveLength(1);
  });

  it("sigue viendo el par de UNA palabra de siempre", () => {
    const ex = meaning("mejor", "better", ["better", "worse", "a perfume", "crunchy"]);
    expect(d4(ex)).toHaveLength(1);
  });

  it("mismo nucleo con la polaridad cambiada, en espanol", () => {
    const ex = fill("con azucar", "con azucar", ["con azucar", "sin azucar", "dos panes", "una silla"]);
    expect(d4(ex)).toHaveLength(1);
  });

  it("no salta si la respuesta esta FUERA del par", () => {
    const ex = meaning("mojado", "wet, with water on it", [
      "wet, with water on it", "new and very clean", "small and very thin", "old and very dark",
    ]);
    noD4(ex);
  });

  it("no salta con dos pares (el alumno ya no queda a 50%)", () => {
    const ex = fill("sube", "sube", ["sube", "baja", "entra", "sale"]);
    noD4(ex);
  });
});

describe("D4 no canta de mas", () => {
  it("compartir una palabra no es ser opuestos", () => {
    const ex = fill("olor de pan", "olor de pan", ["olor de pan", "color de cielo", "precio de cafe", "tamano de vaso"]);
    noD4(ex);
  });

  it("cuatro opciones del mismo molde, sin opuestos", () => {
    const ex = fill("guarda vuelto", "guarda vuelto", ["guarda vuelto", "cuenta plata", "abre puertas", "canta bajo"]);
    noD4(ex);
  });

  it("una definicion por contraste lleva los dos lados dentro", () => {
    const ex = meaning("correcta", "right, not wrong", [
      "right, not wrong", "blue in color", "very thin and small", "wet with rain water",
    ]);
    noD4(ex);
  });

  it("el opuesto negado en su propia opcion no hace par", () => {
    const ex = meaning("caliente", "hot to the touch, not cold at all", [
      "hot to the touch, not cold at all", "cold water in a glass", "served him", "to put up with",
    ]);
    noD4(ex);
  });

  it("en una glosa inglesa, un opuesto suelto no hace par", () => {
    const ex = meaning("mano abierta", "a hand held flat and open", [
      "a hand held flat and open", "a hand closed into a fist", "a hand raised to wave", "a hand hidden in a pocket",
    ]);
    noD4(ex);
  });

  it("la particula afirmativa sola no hace par ('me too' contra 'me')", () => {
    const ex = meaning("tambien", "me too", ["me too", "me", "every week", "of course"]);
    noD4(ex);
  });

  it("nucleos distintos aunque uno vaya negado", () => {
    const ex = meaning("ya no", "not anymore", ["not anymore", "not quite", "not often", "not together"]);
    noD4(ex);
  });

  it("la lista espanola no se aplica a otro idioma", () => {
    const ex = fill("papel cae", "papel cae", ["papel cae", "costo sube", "bolsa llega", "vaso canta"]);
    noD4(ex, { language: "italian" });
  });
});
