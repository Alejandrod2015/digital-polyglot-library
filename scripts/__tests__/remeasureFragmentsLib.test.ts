import { describe, it, expect } from "vitest";
import { anclarFragmentos, tiemposDesordenados, type Frag, type W } from "../remeasureFragmentsLib";

function palabras(texto: string, inicioSeg = 0): W[] {
  return texto.split(/\s+/).map((t, i) => ({ text: t, start: inicioSeg + i, end: inicioSeg + i + 0.9 }));
}

describe("anclarFragmentos", () => {
  it("los indices de ancla son monotonos incluso con palabras ambiguas", () => {
    const frags: Frag[] = [
      { index: 4, startSec: 0, endSec: 0, text: "Justine le regarde serieuse" },
      { index: 5, startSec: 0, endSec: 0, text: "Tout ca personne ne le voit" },
      { index: 6, startSec: 0, endSec: 0, text: "Romain regarde son planning" },
    ];
    const words: W[] = palabras("justine le regarde serieuse tout ca personne ne le voit romain regarde son planning", 40);
    const { inicios } = anclarFragmentos(frags, words);
    for (let n = 1; n < inicios.length; n++) expect(inicios[n]).toBeGreaterThanOrEqual(inicios[n - 1]);
  });

  it("no reporta desorden en un caso normal", () => {
    const frags: Frag[] = [
      { index: 0, startSec: 0, endSec: 0, text: "bonjour tout le monde" },
      { index: 1, startSec: 0, endSec: 0, text: "comment allez vous aujourd hui" },
    ];
    const words: W[] = palabras("bonjour tout le monde comment allez vous aujourd hui", 0);
    const { inicios, sinAnclar } = anclarFragmentos(frags, words);
    expect(sinAnclar).toEqual([]);
    expect(tiemposDesordenados(frags, inicios, words)).toEqual([]);
  });
});

describe("tiemposDesordenados", () => {
  // Reproduce el bug real: los indices de ancla estan en orden (4, 8, 11),
  // pero el transcriptor devolvio el timestamp de la palabra en el indice 8
  // ANTES en el tiempo que el de la palabra en el indice 4 (un timestamp
  // fuera de orden del propio STT, no de la busqueda). Antes del arreglo
  // nadie comprobaba esto y _remeasureFragments escribia un fragmento con
  // endSec menor que startSec.
  it("detecta un timestamp de palabra fuera de orden y NO lo deja pasar", () => {
    const frags: Frag[] = [
      { index: 4, startSec: 0, endSec: 0, text: "a" },
      { index: 5, startSec: 0, endSec: 0, text: "b" },
      { index: 6, startSec: 0, endSec: 0, text: "c" },
    ];
    const inicios = [4, 8, 11];
    const words: W[] = Array.from({ length: 15 }, (_, i) => ({ text: `w${i}`, start: i * 2 }));
    // La palabra en el indice 8 llega con un timestamp MENOR que la del 4:
    // el escenario real (dos hablantes solapados / palabra reetiquetada).
    words[8] = { text: "w8", start: 3 }; // menor que words[4].start = 8
    const desorden = tiemposDesordenados(frags, inicios, words);
    expect(desorden).toEqual([5]);
  });

  it("no reporta nada cuando los tiempos crecen normalmente", () => {
    const frags: Frag[] = [
      { index: 0, startSec: 0, endSec: 0, text: "a" },
      { index: 1, startSec: 0, endSec: 0, text: "b" },
    ];
    const inicios = [0, 3];
    const words: W[] = Array.from({ length: 5 }, (_, i) => ({ text: `w${i}`, start: i * 1.5 }));
    expect(tiemposDesordenados(frags, inicios, words)).toEqual([]);
  });
});
