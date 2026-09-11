/** SOLO LECTURA. Para cada candidata a plaza de vocab: si esta en la lista A1/A2
 *  (no cuenta para el suelo B1), si esta en la lista B1 (el techo por historia la
 *  acepta) y quien la ensena ya en portugues, comparando SIN acentos.
 *  Uso: MAPA=<mapa.json de _ptVocabMapa.ts> npx tsx scripts/_pt/candidatas.ts w1 w2 ... */
import * as fs from "fs";
import { isPortugueseA1A2 } from "../../src/lib/cefr/portugueseA1A2";
import { isPortugueseB1Lemma } from "../../src/lib/cefr/portugueseB1";
const sin = (w: string) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const mapa: Record<string, string[]> = JSON.parse(fs.readFileSync(process.env.MAPA!, "utf8"));
const porSin = new Map<string, string[]>();
for (const [k, v] of Object.entries(mapa)) porSin.set(sin(k), [...(porSin.get(sin(k)) ?? []), ...v]);
const fila: string[] = [];
for (const w of process.argv.slice(2)) {
  const a2 = isPortugueseA1A2(w), b1 = isPortugueseB1Lemma(w), quien = porSin.get(sin(w)) ?? [];
  const clase = a2 ? "A1A2" : b1 ? "B1  " : "FUERA";
  fila.push(`${clase} ${w.padEnd(16)} ${quien.length ? "ensenada: " + [...new Set(quien)].join(" ") : "libre"}`);
}
console.log(fila.sort().join("\n"));
