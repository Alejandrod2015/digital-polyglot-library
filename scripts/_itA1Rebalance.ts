/**
 * Rehace la FORMA de la escalera: cambia plazas ancladas que no vuelven por
 * palabras PORTABLES que ya viven en el cuerpo y se reencuentran solas.
 *
 * La regla `vocab-ladder-shape` pide 12 portables de 20; el journey estaba en
 * 20% porque el cero contra el A0 del mismo tipo se llevaba tambien la capa
 * portable. Abierta esa capa (`saveStory.ts`), estas son las palabras que de
 * verdad se reencuentran. Nunca toca un ancla: la que esta fuera de nivel o en
 * el titulo es la que hace que el tema sea ese tema.
 */
import * as fs from "fs";
import { ITALIAN_A1_A2_LEMMAS } from "../src/lib/cefr/italianA1A2";
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const file = "scripts/_itA1/ALL.json";
const dic = JSON.parse(fs.readFileSync("scripts/_itA1/portables.json","utf8")) as Record<string,{type:string,forms:string[],def:string}>;
const st = (JSON.parse(fs.readFileSync(file,"utf8")) as any[])
  .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
const tok = (t:string)=>(t.toLowerCase().match(/\p{L}+/gu) ?? []) as string[];
const cuerpos = st.map(s=>new Set(tok(s.text)));
const sup = (v:any)=>String(v.surface ?? v.word).toLowerCase();
const cuenta = (t:string)=>cuerpos.filter(c=>c.has(t)).length;
const L = ITALIAN_A1_A2_LEMMAS as Set<string>;
const media = ()=>{ const e=st.flatMap(s=>s.vocab.map((v:any)=>cuenta(sup(v)))); return e.reduce((a,b)=>a+b,0)/e.length; };
const PORT = new Set(["verb","adjective","adverb","expression"]);
const esAncla = (s:any,v:any)=> !L.has(String(v.word).toLowerCase())
  || String(s.slug).includes(String(v.word).toLowerCase().slice(0,6))
  || String(s.title).toLowerCase().includes(String(v.word).toLowerCase().slice(0,6));
const usados = new Set(st.flatMap(s=>s.vocab.map((v:any)=>String(v.word).toLowerCase())));
const raiz = (w:string)=>w.toLowerCase().slice(0,5);

console.log(`antes: media ${media().toFixed(2)} · portables ${st.flatMap(s=>s.vocab).filter((v:any)=>PORT.has(v.type)).length}/${st.flatMap(s=>s.vocab).length}`);
let hechos=0;
for (const [i,s] of st.entries()) {
  const objetivo = Number(process.argv[2] ?? 11);
  while (s.vocab.filter((v:any)=>PORT.has(v.type)).length < objetivo) {
    const raices = new Set(s.vocab.map((v:any)=>raiz(String(v.word))));
    const cand = Object.entries(dic)
      .filter(([lema,f]) => !usados.has(lema) && !raices.has(raiz(lema)))
      .map(([lema,f]) => ({ lema, f, forma: f.forms.find(x=>cuerpos[i].has(x)) }))
      .filter(x => !!x.forma && !raices.has(raiz(x.forma!)))
      .map(x => ({ ...x, n: cuenta(x.forma!) }))
      .sort((a,b)=>b.n-a.n);
    const fuera = s.vocab.map((v:any)=>({v,n:cuenta(sup(v))}))
      .filter((x:any)=>x.n<=1 && !esAncla(s,x.v) && !PORT.has(x.v.type))
      .sort((a:any,b:any)=>a.n-b.n)[0];
    if (!cand.length || !fuera) break;
    const c = cand[0];
    s.vocab = s.vocab.filter((x:any)=>x!==fuera.v)
      .concat([{ word: c.lema, surface: c.forma, type: c.f.type, definition: c.f.def }]);
    usados.add(c.lema);
    console.log(`  ${String(s.slug).padEnd(32)} -${sup(fuera.v).padEnd(15)} +${c.forma}(${c.n})`);
    hechos++;
  }
}
console.log(`${hechos} plazas rebalanceadas · media ${media().toFixed(2)} · portables ${st.flatMap(s=>s.vocab).filter((v:any)=>PORT.has(v.type)).length}/${st.flatMap(s=>s.vocab).length}`);
if (process.argv.includes("--apply")) fs.writeFileSync(file, JSON.stringify(st,null,1));
