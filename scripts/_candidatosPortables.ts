/** Para cada historia: plazas que NO recirculan (salen en un solo cuerpo) y
 *  palabras candidatas a sustituirlas, que ya aparecen en su cuerpo Y en otro
 *  cuerpo del journey, no son plaza en ninguna historia y no son del A0. */
import fs from "node:fs";
import { PORTUGUESE_A1_A2_LEMMAS } from "../src/lib/cefr/portugueseA1A2";
const SC = process.argv[3];
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{ slug: string; text: string; vocab: Array<{ word: string; surface?: string }> }>;
const a0 = new Set((JSON.parse(fs.readFileSync(SC + "/a0words.json", "utf8")) as string[]).map((w) => w.toLowerCase()));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = d.map((s) => new Set(tok(s.text)));
const plazas = new Set(d.flatMap((s) => s.vocab.map((v) => String(v.surface ?? v.word).toLowerCase())));
const lemas = new Set(d.flatMap((s) => s.vocab.map((v) => v.word.toLowerCase())));
let solas = 0, cand = 0;
for (const [i, s] of d.entries()) {
  const noRecircula = s.vocab.filter((v) => cuerpos.filter((c) => c.has(String(v.surface ?? v.word).toLowerCase())).length <= 1);
  const candidatas = [...cuerpos[i]].filter((w) =>
    !plazas.has(w) && !lemas.has(w) && !a0.has(w) && w.length > 3 &&
    PORTUGUESE_A1_A2_LEMMAS.has(w) &&
    cuerpos.filter((c, n) => n !== i && c.has(w)).length >= 1);
  solas += noRecircula.length; cand += candidatas.length;
  console.log(`${s.slug.padEnd(28)} no recirculan ${String(noRecircula.length).padStart(2)} · candidatas ${String(candidatas.length).padStart(2)}: ${candidatas.slice(0, 14).join(" ")}`);
}
console.log(`\nplazas que no recirculan ${solas} · candidatas disponibles ${cand}`);
