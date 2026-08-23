/**
 * Ayuda a TEJER la escalera: por cada historia dice cuantas superficies
 * ensenadas en OTRAS historias tiene ya el cuerpo, cuantas le faltan para el
 * objetivo, y cuales estan disponibles (las que hoy salen en pocos cuerpos).
 */
import * as fs from "fs";
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const st = (JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[])
  .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = st.map(s => new Set(tok(s.text)));
const sup = (v: any) => String(v.surface ?? v.word).toLowerCase();
const todas = new Map<string, number>();          // superficie -> historia que la ensena
st.forEach((s, i) => s.vocab.forEach((v: any) => todas.set(sup(v), i)));
const cuenta = (t: string) => cuerpos.filter(c => c.has(t)).length;

const objetivo = Number(process.argv[3] ?? 30);
const solo = process.argv[4];
for (const [i, s] of st.entries()) {
  const ajenas = [...todas].filter(([t, o]) => o !== i && cuerpos[i].has(t)).map(([t]) => t);
  const falta = Math.max(0, objetivo - ajenas.length);
  console.log(`\n### ${s.slug}  (${s.topic}#${s.slotIndex})  ajenas ${ajenas.length}/${objetivo}  faltan ${falta}`);
  if (solo && !s.slug.includes(solo)) continue;
  console.log(`   ya dentro: ${ajenas.join(" ")}`);
  const libres = [...todas].filter(([t, o]) => o !== i && !cuerpos[i].has(t))
    .map(([t]) => ({ t, n: cuenta(t) })).sort((a, b) => a.n - b.n);
  console.log(`   candidatas (con cuantos cuerpos las tienen hoy):`);
  console.log("     " + libres.map(x => `${x.t}:${x.n}`).join(" "));
}
const enc = st.flatMap(s => s.vocab.map((v: any) => cuenta(sup(v))));
console.log(`\nmedia actual ${(enc.reduce((a,b)=>a+b,0)/enc.length).toFixed(2)} sobre ${enc.length} plazas`);
