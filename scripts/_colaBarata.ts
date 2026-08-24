/** Portables con UN solo encuentro que se pueden arreglar sin añadir palabras:
 *  otro cuerpo ya lleva OTRA forma del mismo lema, así que basta con cambiar
 *  esa forma por la superficie exacta de la píldora. */
import fs from "node:fs";
type V = { word: string; surface?: string; anchor?: boolean };
type S = { slug: string; text: string; vocab: V[] };
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as S[];
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = d.map((s) => new Set(tok(s.text)));
const clave = (v: V) => String(v.surface ?? v.word).toLowerCase();
let baratas = 0, solas = 0;
for (const [i, s] of d.entries()) {
  for (const v of s.vocab) {
    if (v.anchor) continue;
    const k = clave(v);
    const n = cuerpos.filter((c) => c.has(k)).length;
    if (n > 1) continue;
    solas++;
    const raiz = k.slice(0, Math.max(4, k.length - 3));
    const cands: string[] = [];
    for (const [j, c] of cuerpos.entries()) {
      if (j === i) continue;
      for (const w of c) if (w !== k && w.startsWith(raiz)) cands.push(`${d[j].slug}:${w}`);
    }
    if (cands.length) { baratas++; console.log(`${k}\t(${s.slug})\t${cands.slice(0, 3).join(" ")}`); }
  }
}
console.log(`\n${baratas} baratas de ${solas} portables con un solo encuentro`);
