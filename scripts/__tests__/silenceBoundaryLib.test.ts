import { describe, it, expect } from "vitest";
import { boundaryFor, type Gap } from "../silenceBoundaryLib";

describe("boundaryFor", () => {
  it("deja el estimado tal cual si ya cae dentro de un hueco real", () => {
    const gaps: Gap[] = [[19.8, 20.71]];
    // Caso real: "la boule au ventre" mide 20.67s de punto medio entre
    // oraciones y cae dentro de este hueco. Recentrar al medio del hueco
    // (20.25s) cortaba antes de que la frase terminara de sonar y la
    // perdia entera del master. El estimado en si (20.67) es el correcto.
    expect(boundaryFor(20.67, gaps)).toBe(20.67);
  });

  it("reproduce el bug real de bbf20063: no debe SIEMPRE recentrar al medio del hueco contenedor", () => {
    const gaps: Gap[] = [[19.796375, 20.710812]];
    const estimado = 20.67;
    const centroDelHueco = (19.796375 + 20.710812) / 2; // 20.25, el bug
    const resultado = boundaryFor(estimado, gaps);
    expect(resultado).not.toBeCloseTo(centroDelHueco, 1);
    expect(resultado).toBe(estimado);
  });

  it("recentra al hueco real mas cercano cuando el estimado no cae en ninguno", () => {
    const gaps: Gap[] = [[10.0, 10.3], [15.0, 15.2]];
    // 11.0 no cae en ningun hueco; el mas cercano por distancia es [10,10.3]
    // (centro 10.15, distancia 0.85) frente a [15,15.2] (centro 15.1,
    // distancia 4.1).
    expect(boundaryFor(11.0, gaps)).toBeCloseTo(10.15, 5);
  });

  it("recentra tambien cuando el hueco mas cercano queda DESPUES del estimado (bug original: solo miraba huecos que terminan antes)", () => {
    const gaps: Gap[] = [[41.821896, 42.687958]];
    // El bug original de alSilencio() solo consideraba huecos con b<=t+0.02:
    // un hueco que EMPIEZA despues del estimado quedaba descartado siempre,
    // sin importar lo cerca que estuviera.
    expect(boundaryFor(41.5, gaps)).toBeCloseTo((41.821896 + 42.687958) / 2, 3);
  });

  it("sin ningun hueco detectado, usa un margen fijo antes del estimado", () => {
    expect(boundaryFor(5.0, [])).toBeCloseTo(4.94, 5);
  });

  it("sin ningun hueco detectado, nunca baja de 0", () => {
    expect(boundaryFor(0.02, [])).toBe(0);
  });

  it("caso real: la pausa corta entre oraciones (seg2 fin 41.82, seg3 inicio 41.84) se acepta tal cual", () => {
    const gaps: Gap[] = [[41.821896, 42.687958]];
    const estimado = (41.82 + 41.84) / 2; // 41.83
    expect(boundaryFor(estimado, gaps)).toBe(estimado);
  });
});
