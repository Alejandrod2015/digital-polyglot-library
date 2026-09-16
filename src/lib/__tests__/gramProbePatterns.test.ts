import { describe, expect, it } from "vitest";

import { RE } from "../gramProbePatterns";

const marcas = (nombre: string, texto: string) => {
  const par = RE.find(([n]) => n === nombre);
  if (!par) throw new Error(`no existe el marcador ${nombre}`);
  return texto.match(par[1]) ?? [];
};

describe("sonda de gramatica: fronteras de palabra con acento", () => {
  // El defecto real, medido el 2026-09-16 en el tema 2 del Cultural ES/LATAM:
  // la sonda contaba "galpo" dentro de "galpon" y "decepcio" dentro de
  // "decepcion" como preteritos, y el tema salia en 18 por 100 oraciones en
  // vez de 13. Ninguna de las dos palabras es un verbo.
  it("no cuenta como preterito un sustantivo acabado en -on", () => {
    expect(marcas("pretérito", "En el galpón está Mayra.")).toEqual([]);
    expect(marcas("pretérito", "La decepción de enero le dura.")).toEqual([]);
    expect(marcas("pretérito", "La emoción y la canción no son verbos.")).toEqual([]);
  });

  it("sigue contando los preteritos de verdad", () => {
    expect(marcas("pretérito", "“No lo regalo”, contestó Mayra.")).toEqual(["contestó"]);
    expect(marcas("pretérito", "Le prestaron un chico y un lugar.")).toEqual(["prestaron"]);
    expect(marcas("pretérito", "Alondra lo miró y dijo que sí.")).toEqual(["miró", "dijo"]);
  });

  it("sigue midiendo el imperfecto en -aba", () => {
    expect(marcas("imperfecto", "Una baqueta golpeaba el aro.")).toEqual(["golpeaba"]);
    // Limite CONOCIDO y no arreglado aqui: la sonda mide por terminacion, asi
    // que un sustantivo acabado en -aba ("silaba", "traba") sigue contando.
    // No es el defecto de las fronteras; para quitarlo haria falta lematizar.
    expect(marcas("imperfecto", "La sílaba y la traba.")).toEqual(["sílaba", "traba"]);
  });

  it("CONTROL: la expresion vieja, con \\b, si casaba dentro de galpón", () => {
    // Asi estaba escrita la marca de preterito hasta el 2026-09-16. Se deja
    // como control para que se vea que el test falla sin el arreglo.
    const vieja = /\b[a-zá-ú]+(ó|aron|ieron)\b/gi;
    expect("En el galpón está Mayra.".match(vieja)).toEqual(["galpó"]);
  });

  it("mide el subjuntivo imperfecto sin caer en para, cara ni vara", () => {
    expect(marcas("subj. imperfecto", "sin que nadie le explicara nada")).toEqual(["explicara"]);
    expect(marcas("subj. imperfecto", "para la cara rara de la vara")).toEqual([]);
  });

  it("mide condicional y estilo indirecto", () => {
    expect(marcas("condicional", "Mayra le explicó que no habría otra.")).toEqual(["habría"]);
    expect(marcas("estilo indirecto", "Mayra le explicó que no habría otra.")).toEqual(["explicó que"]);
  });
});
