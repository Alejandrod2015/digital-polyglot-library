import { describe, it, expect } from "vitest";
import { validateGeneratedStory } from "../validateGeneratedStory";

/**
 * Banco de regresion de la clasificacion narrada / dialogada (2026-09-11).
 *
 * El validador decidia "esto es un turno de dialogo" con tres regex distintas,
 * y dos de ellas tomaban por turno cualquier arranque en mayuscula seguido de
 * dos puntos. Una historia NARRADA con un parrafo "La cantina se llenó:" pasaba
 * a contar como dialogada y se saltaba en silencio ancla sensorial, habla
 * citada y hablante presentado (Traveler ES latam B2, de-pura-muina). Y
 * "Claudia se lo comentó a Marcos:" contaba como turno para
 * body-consecutive-narrators (Traveler ES spain B2).
 *
 * Solo importa el validador, a proposito: este archivo tiene que poder correr
 * contra la version anterior al arreglo y fallar ahi.
 */

const vocab = Array.from({ length: 20 }, (_, i) => ({
  word: `palabra${i}`,
  surface: `palabra${i}`,
  definition: "una palabra de prueba",
  type: "noun",
}));

async function run(text: string) {
  const r = await validateGeneratedStory(
    { title: "La cantina de Beto", synopsis: "Renata vuelve a la cantina.", text, vocab, arcType: "reframe-turn" } as never,
    { language: "ES", level: "b2", variant: "LATAM", existing: [], journeyTitles: [] },
  );
  return new Map(r.checks.map((c) => [c.id, c.status]));
}

describe("historia narrada con 'La cantina se llenó:'", () => {
  // Sin ninguna palabra sensorial: el ancla tiene que FALLAR, no desaparecer.
  const text = [
    "Renata entra en la cantina de su tío Beto, en Guadalajara, México. Es viernes y el tío cuenta billetes detrás de la barra.",
    "La cantina se llenó: vinieron los vecinos, los primos y el cartero del barrio.",
    "“¿Otra vez tarde?”, pregunta Beto. Renata le da un abrazo y se pone el mandil.",
  ].join("\n\n");

  it("sigue corriendo los checks de narrada", async () => {
    const c = await run(text);
    expect(c.has("narrator-quoted-speech")).toBe(true);
    expect(c.has("narrator-speaker-introduced")).toBe(true);
    expect(c.get("narrator-sensory-anchor")).toBe("fail");
  });

  it("no cuenta el arranque como turno de dialogo", async () => {
    const c = await run(text);
    expect(c.get("body-consecutive-narrators")).toBe("pass");
  });
});

describe("'Claudia se lo comentó a Marcos:'", () => {
  it("en una narrada no crea un turno fantasma", async () => {
    const text = [
      "Claudia trabaja en una librería de Valencia, España, con su compañero Marcos. El lunes llega una caja equivocada.",
      "Claudia se lo comentó a Marcos: la caja traía cuarenta novelas iguales y ningún diccionario.",
      "“Pues las vendemos igual”, dice Marcos. Claudia no sabe si habla en serio.",
      "Al final ponen las novelas en el escaparate, con un cartel pequeño.",
    ].join("\n\n");
    const c = await run(text);
    expect(c.get("body-consecutive-narrators")).toBe("pass");
    expect(c.has("narrator-sensory-anchor")).toBe(true);
  });

  it("en una multivoz no tapa dos narradores seguidos", async () => {
    const text = [
      "Claudia y Marcos abren la librería de Valencia, España, a las nueve. Llega una caja equivocada.",
      "Claudia: Mira esto, son cuarenta novelas iguales.",
      "Marcos: Y ningún diccionario. Qué raro.",
      "Claudia: Llamo a la editorial ahora mismo.",
      "Marcos: Espera un momento, que yo tengo una idea.",
      "Marcos saca las novelas de la caja una por una.",
      "Claudia se lo comentó a Marcos: la editorial no contesta hasta el lunes.",
      "Los dos se quedan mirando la caja abierta.",
      "Claudia: Pues las ponemos en el escaparate.",
    ].join("\n\n");
    const c = await run(text);
    expect(c.get("body-consecutive-narrators")).toBe("warn");
  });
});
