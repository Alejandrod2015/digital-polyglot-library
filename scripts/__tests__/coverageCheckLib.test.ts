import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { canonNumbers, checkCoverage, findGaps, findDuplicates, norm } from "../coverageCheckLib";

const w = (s: string) => s.split(/\s+/).map(norm).filter(Boolean);

describe("checkCoverage", () => {
  it("pasa limpio con el master ORIGINAL (sin duplicados ni huecos)", () => {
    // Reproduce, simplificado, la estructura real del master bueno de
    // une-liste-dans-la-tete: todo el texto aparece una vez, en orden.
    const text = w(
      "Ca fait au moins dix points non Tu ne me remercies pas demande Romain " +
      "Justine le regarde serieuse et compte sur ses doigts Cette semaine " +
      "jai pris ton rendezvous chez le dentiste jai trouve le cadeau pour " +
      "ta soeur et jai pense a ta brosse a dents Tout ca personne ne le " +
      "voit Mais moi je le porte dans ma tete tous les jours continue Justine " +
      "Romain regarde son planning et tout a coup il le trouve bete"
    );
    const heard = text; // el master original dice exactamente el texto
    const res = checkCoverage(text, heard);
    expect(res.ok).toBe(true);
  });

  it("detecta el master ROTO (duplicado + hueco) de une-liste-dans-la-tete", () => {
    const text = w(
      "Ca fait au moins dix points non Tu ne me remercies pas demande Romain " +
      "Justine le regarde serieuse et compte sur ses doigts Cette semaine " +
      "jai pris ton rendezvous chez le dentiste jai trouve le cadeau pour " +
      "ta soeur et jai pense a ta brosse a dents Tout ca personne ne le " +
      "voit Mais moi je le porte dans ma tete tous les jours continue Justine " +
      "Romain regarde son planning et tout a coup il le trouve bete"
    );
    // El master roto: "Ca fait...Romain" y "Romain regarde...bete" suenan
    // DOS veces, y todo el tramo intermedio ("compte sur ses doigts"..."continue
    // Justine") desaparece, exactamente como se transcribio de verdad.
    const heard = w(
      "Ca fait au moins dix points non Tu ne me remercies pas demande Romain " +
      "Justine le regarde serieuse " +
      "Ca fait au moins dix points non Tu ne me remercies pas demande Romain " +
      "Romain regarde son planning et tout a coup il le trouve bete " +
      "Romain regarde son planning et tout a coup il le trouve bete"
    );
    const res = checkCoverage(text, heard);
    expect(res.ok).toBe(false);
    expect(res.duplicates.length).toBeGreaterThan(0);
    expect(res.gaps.length).toBeGreaterThan(0);
    // el hueco tiene que cubrir el tramo perdido de verdad (dentiste y
    // rendezvous no aparecen en ningun otro punto de lo oido, a diferencia
    // de "justine", que si se repite en el bloque duplicado y por eso no
    // cuenta como ausente en esta busqueda sin posicion)
    const gapText = res.gaps.map((g) => g.textWords.join(" ")).join(" | ");
    expect(gapText).toContain("compte");
    expect(gapText).toContain("cette semaine");
  });
});

describe("findGaps", () => {
  it("tolera ortografia distinta del transcriptor (no es un hueco)", () => {
    const text = w("Justine goutte un morceau et sourit");
    const heard = w("Justine goute en morceau et sourit"); // errores de whisper-small
    const gaps = findGaps(text, heard);
    expect(gaps).toEqual([]);
  });

  it("marca un hueco real de 3+ palabras que no aparecen ni parecidas", () => {
    const text = w("Bonjour Marc comment vas tu aujourdhui vraiment bien merci");
    const heard = w("Bonjour Marc merci"); // faltan "comment vas tu aujourdhui vraiment bien"
    const gaps = findGaps(text, heard);
    expect(gaps.length).toBe(1);
    expect(gaps[0].textWords.length).toBeGreaterThanOrEqual(3);
  });

  it("no marca hueco si faltan menos de 3 palabras seguidas", () => {
    const text = w("Bonjour vraiment tres content de te voir");
    const heard = w("Bonjour content de te voir");
    const gaps = findGaps(text, heard);
    expect(gaps).toEqual([]);
  });
});

describe("findDuplicates", () => {
  it("detecta un tramo de 5+ palabras repetido identico", () => {
    const heard = w("le chat noir dort sur le canapé le chat noir dort sur le tapis");
    const text = w("le chat noir dort sur le canapé et sur le tapis");
    const dups = findDuplicates(heard, text, 5);
    expect(dups.length).toBeGreaterThan(0);
  });

  it("no marca nada en texto normal sin repeticion", () => {
    const heard = w("le chat noir dort et le chien blanc joue dehors");
    const dups = findDuplicates(heard, heard, 5);
    expect(dups).toEqual([]);
  });

  it("no es duplicado si el texto tambien lo repite (titulo que vuelve en el cuerpo)", () => {
    const text = w("La sauce ne tient pas. Nathalie cuisine. Nathalie! La sauce ne tient pas!");
    const dups = findDuplicates(text, text, 5);
    expect(dups).toEqual([]);
  });

  it("si es duplicado si el audio lo repite mas veces que el texto", () => {
    const text = w("La sauce ne tient pas. Nathalie cuisine. Nathalie! La sauce ne tient pas!");
    const heard = w("La sauce ne tient pas. La sauce ne tient pas. Nathalie cuisine. Nathalie! La sauce ne tient pas!");
    const dups = findDuplicates(heard, text, 5);
    expect(dups.length).toBe(1);
    expect(dups[0].heardCount).toBe(3);
    expect(dups[0].textCount).toBe(2);
  });
});

describe("canonNumbers", () => {
  it("letra y cifra llegan a lo mismo", () => {
    expect(canonNumbers(w("a vingt et une heures"))).toEqual(canonNumbers(w("a 21h")));
    expect(canonNumbers(w("a vingt heures"))).toEqual(canonNumbers(w("a 20h")));
    expect(canonNumbers(w("au moins dix points"))).toEqual(canonNumbers(w("au moins 10 points")));
    expect(canonNumbers(w("dix-sept ans"))).toEqual(["17", "ans"]);
    expect(canonNumbers(w("quatre-vingt-dix euros"))).toEqual(["90", "euros"]);
    expect(canonNumbers(w("trente mille euros"))).toEqual(["30000", "euros"]);
    expect(canonNumbers(w("deux cents euros"))).toEqual(["200", "euros"]);
  });

  it("un/une sueltos siguen siendo articulo", () => {
    expect(canonNumbers(w("encore une voie"))).toEqual(["encore", "une", "voie"]);
    expect(canonNumbers(w("un prof et une copine"))).toEqual(["un", "prof", "et", "une", "copine"]);
  });

  it("dos cifras distintas no se confunden por distancia de edicion", () => {
    expect(findGaps(w("il part a vingt et une heures ce soir"), w("il part a 20 heures ce soir"), 1).length).toBe(1);
  });
});

// Masters REALES del Friends FR A2, transcritos con whisper-small local
// (scripts/_dumpCoverageFixtures.ts). Los 3 limpios daban falsa alarma antes
// de canonNumbers y del conteo contra el texto; los 5 rotos son los empalmes
// del 2026-09-14 que perdieron o duplicaron frases.
describe("masters reales FR A2", () => {
  type Fx = { slug: string; expected: "limpio" | "roto"; text: string; heard: string[] };
  const fixtures = JSON.parse(
    readFileSync(path.join(__dirname, "fixtures", "coverage-fr-a2-masters.json"), "utf8"),
  ) as Fx[];

  it("hay 3 limpios y 5 rotos", () => {
    expect(fixtures.filter((f) => f.expected === "limpio").length).toBe(3);
    expect(fixtures.filter((f) => f.expected === "roto").length).toBe(5);
  });

  for (const f of fixtures) {
    it(`${f.slug} sale ${f.expected}`, () => {
      const res = checkCoverage(w(f.text), f.heard.map(norm).filter(Boolean));
      expect(res.ok).toBe(f.expected === "limpio");
    });
  }
});

describe("canonNumbers aleman", () => {
  it("compuestos con und y hundert", () => {
    expect(canonNumbers(w("einundzwanzig"), "de")).toEqual(["21"]);
    expect(canonNumbers(w("fünfundzwanzig"), "de")).toEqual(["25"]);
    expect(canonNumbers(w("dreißig"), "de")).toEqual(["30"]);
    expect(canonNumbers(w("hundertfünfzig"), "de")).toEqual(["150"]);
    expect(canonNumbers(w("dreizehn Uhr"), "de")).toEqual(["13", "uhr"]);
  });

  it("ein suelto sigue siendo articulo, eins no", () => {
    expect(canonNumbers(w("ein Hund"), "de")).toEqual(["ein", "hund"]);
    expect(canonNumbers(w("es sind eins"), "de")).toEqual(["es", "sind", "1"]);
  });

  it("no cambia el comportamiento frances por defecto (lang omitido)", () => {
    expect(canonNumbers(w("vingt et une heures"))).toEqual(["21", "heures"]);
  });
});

describe("canonNumbers italiano", () => {
  it("compuestos con elision de vocal (uno/otto) y sin ella", () => {
    expect(canonNumbers(w("ventuno anni"), "it")).toEqual(["21", "anni"]);
    expect(canonNumbers(w("ventotto anni"), "it")).toEqual(["28", "anni"]);
    expect(canonNumbers(w("ventitre anni"), "it")).toEqual(["23", "anni"]); // acento ya lo quita norm()
    expect(canonNumbers(w("trentacinque euro"), "it")).toEqual(["35", "euro"]);
    expect(canonNumbers(w("novantanove"), "it")).toEqual(["99"]);
  });

  it("decenas y teens sueltos", () => {
    expect(canonNumbers(w("venti minuti"), "it")).toEqual(["20", "minuti"]);
    expect(canonNumbers(w("diciassette anni"), "it")).toEqual(["17", "anni"]);
    expect(canonNumbers(w("dodici euro"), "it")).toEqual(["12", "euro"]);
  });

  it("letra y cifra llegan a lo mismo", () => {
    expect(canonNumbers(w("ha ventitre anni"), "it")).toEqual(canonNumbers(w("ha 23 anni"), "it"));
  });

  it("no cambia el comportamiento frances por defecto (lang omitido)", () => {
    expect(canonNumbers(w("vingt et une heures"))).toEqual(["21", "heures"]);
  });
});

// Masters REALES del Friends DE C1 publicado, transcritos con
// `whisper-cli -l de` (probado en seco 2026-09-15 antes del Friends DE A1:
// con -l fr, 2 de los 3 daban huecos falsos por numeros/ortografia mal
// leidos; con -l de, limpios salvo "alaaf-fur-die-neue", que falla en una
// linea real en dialecto colones que whisper transcribe distinto, no un
// fallo del candado, y por eso no entra en este fixture).
describe("masters reales DE C1", () => {
  type Fx = { slug: string; expected: "limpio" | "roto"; text: string; heard: string[] };
  const fixtures = JSON.parse(
    readFileSync(path.join(__dirname, "fixtures", "coverage-de-c1-masters.json"), "utf8"),
  ) as Fx[];

  it("hay 2 masters", () => {
    expect(fixtures.length).toBe(2);
  });

  for (const f of fixtures) {
    it(`${f.slug} sale limpio con la tabla de numeros alemana`, () => {
      const res = checkCoverage(w(f.text), f.heard.map(norm).filter(Boolean), "de");
      expect(res.ok).toBe(true);
    });
  }
});
