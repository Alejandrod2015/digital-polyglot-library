/** El techo real de la escalera con esta prosa: coge las palabras del pool que
 *  mas cuerpos tocan, hasta llenar las 441 plazas, y suma. */
import * as fs from "fs";
const S = JSON.parse(fs.readFileSync("scripts/_b1/data/all.json", "utf8"));
const pool = new Set(fs.readFileSync("scripts/_b1/pool-limpio.txt", "utf8").split(/\r?\n/).filter(Boolean));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}{3,}/gu) ?? []);
const cuerpos = S.map((s: any) => new Set(tok(s.text)));
const cuenta = new Map<string, number>();
for (const c of cuerpos) for (const w of c) if (pool.has(w)) cuenta.set(w, (cuenta.get(w) ?? 0) + 1);
const orden = [...cuenta].sort((a, b) => b[1] - a[1]);
const plazas = S.reduce((a: number, s: any) => a + s.vocab.length, 0);
console.log(`palabras del pool presentes en los 21 cuerpos: ${orden.length} · plazas a llenar: ${plazas}`);
const dos = orden.filter(([, n]) => n >= 2);
console.log(`de ellas, en 2+ cuerpos: ${dos.length}, que suman ${dos.reduce((a, b) => a + b[1], 0)} encuentros`);
const usadas = orden.slice(0, plazas);
const suma = usadas.reduce((a, b) => a + b[1], 0) + Math.max(0, plazas - usadas.length);
console.log(`\nTECHO con esta prosa: ${(suma / plazas).toFixed(2)} de media`);
console.log(`(las ${Math.min(plazas, orden.length)} mejores suman ${usadas.reduce((a, b) => a + b[1], 0)}; el resto valdria 1)`);
