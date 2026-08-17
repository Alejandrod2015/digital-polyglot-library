/**
 * Dice qué palabras pasan el juez CEFR a un nivel dado, antes de escribirlas
 * en un vocab. Evita iterar a ciegas contra el validador.
 *
 *   npx tsx scripts/_probeWords.ts a1 palabra otra "dos palabras"
 */
import { isSpanishUpToLevel } from "../src/lib/cefr/spanishLevels";

const level = (process.argv[2] ?? "a1") as "a1" | "a2" | "b1" | "b2" | "c1";
const words = process.argv.slice(3);
const ok: string[] = [], no: string[] = [];
for (const w of words) (isSpanishUpToLevel(w, level) ? ok : no).push(w);
console.log(`pasan (${ok.length}): ${ok.join(", ")}`);
console.log(`FUERA (${no.length}): ${no.join(", ")}`);
