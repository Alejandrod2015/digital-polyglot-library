import { describe, it, expect } from "vitest";
import { checkCoverage, findGaps, findDuplicates, norm } from "../coverageCheckLib";

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
    // el hueco tiene que cubrir el tramo perdido de verdad
    const gapText = res.gaps.map((g) => g.textWords.join(" ")).join(" | ");
    expect(gapText).toContain("compte");
    expect(gapText).toContain("justine");
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
    const dups = findDuplicates(heard, 5);
    expect(dups.length).toBeGreaterThan(0);
  });

  it("no marca nada en texto normal sin repeticion", () => {
    const heard = w("le chat noir dort et le chien blanc joue dehors");
    const dups = findDuplicates(heard, 5);
    expect(dups).toEqual([]);
  });
});
