/** Por cuerpo: palabras del pool que aparecen en 2+ cuerpos del journey.
 *  Son las unicas que pueden ser plaza sin hundir la escalera. */
import * as fs from "fs";
const S = JSON.parse(fs.readFileSync("scripts/_b1/data/all.json", "utf8"));
const pool = new Set(fs.readFileSync("scripts/_b1/pool-limpio.txt", "utf8").split(/\r?\n/).filter(Boolean));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}{4,}/gu) ?? []);
const cuerpos = S.map((s: any) => new Set(tok(s.text)));
const cuenta = new Map<string, number>();
for (const c of cuerpos) for (const w of c) cuenta.set(w, (cuenta.get(w) ?? 0) + 1);
let tot = 0;
for (const [i, s] of S.entries()) {
  const c = [...cuerpos[i]].filter((w: string) => pool.has(w) && (cuenta.get(w) ?? 0) >= 2);
  tot += c.length;
  console.log(`${String(s.topic + "#" + s.slotIndex).padEnd(30)} ${String(c.length).padStart(3)} candidatas de 2+ cuerpos`);
}
console.log(`\nmedia ${(tot / S.length).toFixed(1)} candidatas por cuerpo (se necesitan 21 por historia)`);
