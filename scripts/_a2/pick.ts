/**
 * De cada palabra: si esta en la lista A1+A2, si ya la ensena un Traveler de
 * Espana (tope 0) o el Friends de Espana (tope 2 por historia). Sin base:
 * lee los ficheros que deja `pool.ts`.
 *
 *   npx tsx scripts/_a2/pick.ts palabra1 palabra2 ...
 *   npx tsx scripts/_a2/pick.ts --file lista.txt
 */
import * as fs from "fs";
import { SPANISH_A1_A2_LEMMAS } from "../../src/lib/cefr/spanishA1A2";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";

const lema = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const libre = new Set(fs.readFileSync("scripts/_a2/pool-libre.txt", "utf8").split("\n").map(lema).filter(Boolean));
const tope2 = new Set(fs.readFileSync("scripts/_a2/pool-tope2.txt", "utf8").split("\n").map(lema).filter(Boolean));
const ocup = new Map(fs.readFileSync("scripts/_a2/ocupadas.txt", "utf8").split("\n").filter(Boolean)
  .map((l) => { const [w, j] = l.split("\t"); return [lema(w), j] as const; }));
const listaA1A2 = new Set([...SPANISH_A1_A2_LEMMAS].map(lema));

const args = process.argv.slice(2);
const words = args[0] === "--file"
  ? fs.readFileSync(args[1], "utf8").split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  : args;
let ok = 0;
for (const w of words) {
  const l = lema(w);
  let veredicto: string;
  if (libre.has(l)) { veredicto = tope2.has(l) ? "TOPE2 (la ensena el Friends A0)" : "LIBRE"; if (!tope2.has(l)) ok++; }
  else if (ocup.has(l)) veredicto = `PROHIBIDA · ya la ensena ${ocup.get(l)}`;
  else if (!listaA1A2.has(l)) veredicto = isSpanishUpToLevel(w, "a2") ? "fuera de la lista, pero el lookup la da <=A2" : "FUERA DE LA LISTA A1+A2";
  else veredicto = "?";
  console.log(`${w.padEnd(18)} ${veredicto}`);
}
console.log(`\n${ok}/${words.length} libres del todo.`);
