/**
 * Cuarto encuentro COMO PLAZA, SIN quitar ninguna.
 *
 * La escalera pide cuatro reencuentros por palabra portable. Los encuentros 2 y
 * 3 caben en el texto; el 4o, a seis historias o mas de distancia, es el que el
 * catalogo resuelve con una SEGUNDA plaza (Traveler ES/LATAM re-ensena 229 y
 * saca 4,21; Friends IT A0, 218 y 3,24).
 *
 * Reglas: nunca mas de DOS plazas por palabra y seis historias de distancia
 * minima. La segunda plaza se AÑADE, no sustituye: la primera version cambiaba
 * la palabra portable por una anclada de las que salen una sola vez, y esas son
 * justo `rubinetto`, `sindaco`, `anguria` o `cattedrale`, es decir lo que hace
 * que un tema sea ese tema y no otro ([[project_topic_naming_rule]]). El techo
 * de `vocab-count` (25 con cuerpos de 170 palabras) deja sitio de sobra.
 */
import * as fs from "fs";
import { ITALIAN_A1_A2_LEMMAS } from "../src/lib/cefr/italianA1A2";
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const file = process.argv[2];
const st = (JSON.parse(fs.readFileSync(file, "utf8")) as any[])
  .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = st.map(s => new Set(tok(s.text)));
const sup = (v:any) => String(v.surface ?? v.word).toLowerCase();
const cuenta = (t: string) => cuerpos.filter(c => c.has(t)).length;
const L = ITALIAN_A1_A2_LEMMAS as Set<string>;
const ficha = new Map<string, any>(), donde = new Map<string, number[]>();
st.forEach((s,i)=>s.vocab.forEach((v:any)=>{ ficha.set(sup(v), v); donde.set(sup(v), [...(donde.get(sup(v))??[]), i]); }));
const media = () => { const e = st.flatMap(s=>s.vocab.map((v:any)=>cuenta(sup(v)))); return e.reduce((a,b)=>a+b,0)/e.length; };
/** Un ancla no se toca: define el tema y por eso pagaba una plaza fuera de nivel. */
const esAncla = (s:any, v:any) => !L.has(String(v.word).toLowerCase())
  || s.slug.includes(String(v.word).toLowerCase().slice(0,6))
  || String(s.title).toLowerCase().includes(String(v.word).toLowerCase().slice(0,6));
console.log(`media antes ${media().toFixed(2)} · ${st.flatMap(s=>s.vocab).length} plazas`);
let hechos = 0;
for (const [i,s] of st.entries()) {
  for (let n = 0; n < 8; n++) {
    const mias = new Set(s.vocab.map(sup));
    const cand = [...ficha].filter(([t]) => !mias.has(t) && cuerpos[i].has(t)
        && donde.get(t)!.length === 1 && cuenta(t) >= 4
        && donde.get(t)!.every(o => Math.abs(o - i) >= 6))
      .sort((a,b)=>cuenta(b[0])-cuenta(a[0]));
    const techo = Math.max(25, Math.round(String(s.text).trim().split(/\s+/).length / 9));
    if (!cand.length || s.vocab.length >= techo) break;
    const [t, v] = cand[0];
    if (cuenta(t) <= 1) break;
    s.vocab = s.vocab.concat([{ ...v }]);
    donde.set(t, [...donde.get(t)!, i]);
    console.log(`  ${s.slug.padEnd(32)} +${t}(${cuenta(t)})  [${s.vocab.length}/${techo}]`);
    hechos++;
  }
}
console.log(`${hechos} segundas plazas · media despues ${media().toFixed(2)}`);
if (process.argv.includes("--apply")) fs.writeFileSync(file, JSON.stringify(st, null, 1));
