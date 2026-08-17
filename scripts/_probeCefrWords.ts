import { isSpanishUpToLevel } from "../src/lib/cefr/spanishLevels";

const WORDS = [
  // anclas culturales del journey
  "caseta", "rebujito", "sevillana", "paella", "socarrat", "queimada", "conxuro",
  "meigas", "jata", "majada", "cercanías", "abono", "portería", "conserje",
  "portero", "telefonillo",
  // palabras corrientes que el juez marcó fuera de A2
  "montes", "niebla", "muchísimo", "cualquiera", "adónde", "casualidad",
  "promete", "sienta", "sientan",
  // control: A2 indiscutible
  "casa", "comer", "grande", "madre", "agua",
];

for (const lvl of ["a2", "b1", "b2", "c1"] as const) {
  const fails = WORDS.filter((w) => !isSpanishUpToLevel(w, lvl));
  console.log(`${lvl.toUpperCase()}: fuera de nivel ${fails.length}/${WORDS.length} → ${fails.join(", ")}`);
}
