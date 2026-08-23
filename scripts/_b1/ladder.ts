/** Escalera del fichero: cuantos cuerpos contienen cada clave, y donde faltan. */
import * as fs from "fs";
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos: Array<{ id: string; set: Set<string> }> = S.map((s: any) => ({ id: `${s.topic}#${s.slotIndex}`, set: new Set(tok(s.text)) }));
const filas: Array<{ k: string; n: number; de: string }> = [];
for (const s of S) for (const v of s.vocab) {
  const k = String(v.surface ?? v.word).toLowerCase();
  filas.push({ k, n: cuerpos.filter((c) => c.set.has(k)).length, de: `${s.topic}#${s.slotIndex}` });
}
const media = filas.reduce((a, b) => a + b.n, 0) / filas.length;
console.log(`media ${media.toFixed(2)} sobre ${filas.length} plazas · ${filas.filter((f) => f.n <= 1).length} con una sola aparicion`);
const falta = Math.ceil(2.0 * filas.length) - filas.reduce((a, b) => a + b.n, 0);
console.log(`faltan ${falta} apariciones para la media 2,5`);
if (process.argv[3] === "--lista") {
  for (const f of filas.filter((x) => x.n <= 1).sort((a, b) => a.de.localeCompare(b.de)))
    console.log(`  ${f.n}  ${f.k.padEnd(18)} ${f.de}`);
}
if (process.argv[3] === "--top") {
  const m = new Map<string, number>();
  for (const f of filas) m.set(f.k, f.n);
  for (const [k, n] of [...m].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`  ${n}  ${k}`);
}
