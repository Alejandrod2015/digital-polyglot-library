/** SOLO LECTURA. Replica journey-vocab-recirculation (validateJourneyStories.ts,
 *  bloque 12) sobre un JSON de historias y lista las plazas PORTABLES de una
 *  palabra cuya superficie exacta sale en un solo cuerpo: son las unicas que
 *  se arreglan tejiendo esa misma forma en otra historia. Las de varias
 *  palabras nunca emparejan (el gate tokeniza palabra a palabra).
 *  Uso: npx tsx scripts/_pt/recircula.ts <historias.json> */
import * as fs from "fs";
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{ slug: string; text: string; vocab: Array<{ word: string; surface?: string; anchor?: boolean }> }>;
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = d.map((s) => new Set(tok(s.text)));
const clave = (v: { word: string; surface?: string | null }) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
const port: Array<{ n: number; slug: string; k: string; multi: boolean }> = [];
let anc = 0, tot = 0;
for (const s of d) for (const v of s.vocab) {
  tot++;
  if (v.anchor) { anc++; continue; }
  const k = clave(v);
  port.push({ n: cuerpos.filter((c) => c.has(k)).length, slug: s.slug, k, multi: /\s/.test(k) });
}
const unaVez = port.filter((x) => x.n <= 1).length;
const media = port.reduce((a, b) => a + b.n, 0) / port.length;
console.log(`portables ${port.length} · media ${media.toFixed(3)} (suelo B1 1,2) · una sola vez ${unaVez} (${Math.round((100 * unaVez) / port.length)}%, tope 80% = ${Math.floor(port.length * 0.8)}) · ancladas ${anc}/${tot} (${Math.round((100 * anc) / tot)}%)`);
console.log(`multipalabra (n=0 siempre): ${port.filter((x) => x.multi).length}`);
const cand = port.filter((x) => !x.multi && x.n <= 1);
const by = new Map<string, string[]>();
for (const c of cand) by.set(c.slug, [...(by.get(c.slug) ?? []), c.k]);
for (const [s, ks] of by) console.log(`${s}: ${ks.join(", ")}`);
