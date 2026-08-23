/** Chequeo rápido de un borrador: píldoras bloqueadas por el A0, repetidas
 *  dentro de la tanda, ausentes del cuerpo, y el reparto portable/anclada. */
import { readFileSync } from "fs";
const stories = JSON.parse(readFileSync(process.argv[2], "utf8"));
const bloq = new Set<string>(JSON.parse(readFileSync(process.argv[3], "utf8")));
const tok = (t: string) => new Set((t.toLowerCase().match(/[a-zà-ú]+/g) ?? []));
const vistas = new Map<string, string>();
for (const s of stories) {
  const cuerpo = tok(s.text);
  const malas: string[] = [], fuera: string[] = [], repes: string[] = [];
  for (const v of s.vocab ?? []) {
    const w = String(v.word).toLowerCase(), su = String(v.surface ?? v.word).toLowerCase();
    if (!cuerpo.has(su)) malas.push(su);
    if (bloq.has(w)) fuera.push(w);
    if (vistas.has(w)) repes.push(`${w}(${vistas.get(w)})`); else vistas.set(w, s.topic + "#" + s.slotIndex);
  }
  const pal = String(s.text).split(/\s+/).length;
  const cit = [...String(s.text).matchAll(/[“]([^”]*)[”]/g)].reduce((a, m) => a + m[1].split(/\s+/).length, 0);
  const anc = (s.vocab ?? []).filter((v: any) => v.anchor).length;
  console.log(`${s.topic}#${s.slotIndex} ${pal}p ${Math.round(100 * cit / pal)}% · plazas ${(s.vocab ?? []).length} (ancladas ${anc}) ${malas.length ? "· NO EN CUERPO: " + malas.join(",") : ""} ${fuera.length ? "· BLOQUEADAS A0: " + fuera.join(",") : ""} ${repes.length ? "· REPETIDAS: " + repes.join(",") : ""}`);
}
