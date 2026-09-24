import { describe, it, expect } from "vitest";
import { formasDeVerbo } from "../cefr/spanishConjugations";

/**
 * El diptongo que abre la palabra lleva H (2026-09-23).
 *
 * `formasDeVerbo` ya conjugaba con la raiz diptongada (contar -> cuenta), pero
 * cuando la raiz empieza por la vocal que diptonga, la ortografia mete una H
 * que la generacion no ponia: de "oler" salia "uele" y nunca "huele". La plaza
 * de vocab perdia sus encuentros aunque el lector leyera el mismo verbo en dos
 * historias; medido en el Conversations ES latam A0, dos plazas "oler" se
 * contaban como unicas con el verbo en dos cuerpos.
 *
 * Como el resto de la funcion, genera de mas: una forma inventada solo cuenta
 * si aparece literal en un cuerpo, y entonces es ese verbo. Por eso una plaza
 * solo puede SUBIR de cuenta con esto, nunca bajar, y ningun suelo se recalibra.
 */
describe("formasDeVerbo pone la H del diptongo inicial", () => {
  it("oler da huele y huelen, y conserva las regulares", () => {
    const f = formasDeVerbo("oler");
    expect(f.has("huele")).toBe(true);
    expect(f.has("huelen")).toBe(true);
    expect(f.has("olemos")).toBe(true);
  });

  it("errar da yerra", () => {
    expect(formasDeVerbo("errar").has("yerra")).toBe(true);
  });

  it("un verbo sin diptongo inicial no pierde nada", () => {
    const f = formasDeVerbo("contar");
    expect(f.has("cuenta")).toBe(true);
    expect(f.has("contamos")).toBe(true);
  });
});
