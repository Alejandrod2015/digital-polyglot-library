/**
 * La CURVA de la escalera: lo portable entra como muy tarde en la historia 15;
 * de la 16 a la 21 solo entran ancladas y RECICLADO.
 *
 * Por que (project_vocab_recirculation_ladder): una palabra portable que se
 * enseña en la 21 no tiene donde volver a aparecer, asi que se lleva la plaza y
 * no da ningun reencuentro. La cola no se arregla con parches sino con la
 * forma: vocabulario nuevo descendente y las ultimas historias reciclando.
 *
 * Hace dos cosas y en este orden:
 *   1. Cada plaza PORTABLE que hoy se enseña en la 16-21 se muda a una historia
 *      de la 1 a la 15 que ya tenga esa forma en el cuerpo.
 *   2. El hueco que deja se llena con el 4o encuentro de una portable enseñada
 *      antes de la 15, que es lo que "reciclar" significa aqui.
 * Nunca toca un ancla ni rompe el reparto por bloques del lector.
 */
import * as fs from "fs";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const PORT = new Set(["verb","adjective","adverb","expression"]);
const CORTE = 15;                       // posicion 1-based: hasta aqui entra lo portable
const file = "scripts/_itA1/ALL.json";
const dic = JSON.parse(fs.readFileSync("scripts/_itA1/portables.json","utf8")) as Record<string,{type:string,forms:string[],def:string}>;
/** Formas plausibles de un lema: las del diccionario y, si no esta, las cuatro
 *  terminaciones del adjetivo italiano mas la propia superficie. */
const formas = (v: any): string[] => {
  const w = String(v.word).toLowerCase();
  const base = dic[w]?.forms ?? [];
  const raizAdj = w.replace(/[oaei]$/, "");
  return [...new Set([...base, String(v.surface ?? v.word).toLowerCase(), w,
    raizAdj + "o", raizAdj + "a", raizAdj + "i", raizAdj + "e"])];
};
const st = (JSON.parse(fs.readFileSync(file,"utf8")) as any[])
  .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]) as string[];
const cuerpos = st.map(s=>new Set(tok(s.text)));
const sup=(v:any)=>String(v.surface??v.word).toLowerCase();
const cuenta=(t:string)=>cuerpos.filter(c=>c.has(t)).length;
const raiz=(w:string)=>w.toLowerCase().slice(0,5);
const bloques = st.map(s=>renderedParagraphs(s.text));
const reparto=(s:any,i:number)=>{const per=bloques[i].map(b=>s.vocab.filter((v:any)=>b.includes(v.surface??v.word)).length);return Math.max(...per)/s.vocab.length;};
const techo=(s:any)=>Math.max(25, Math.round(String(s.text).trim().split(/\s+/).length/9));
const media=()=>{const e=st.flatMap(s=>s.vocab.map((v:any)=>cuenta(sup(v))));return e.reduce((a,b)=>a+b,0)/e.length;};
const veces=(w:string)=>st.reduce((n,s)=>n+s.vocab.filter((v:any)=>String(v.word).toLowerCase()===w).length,0);

console.log(`antes: media ${media().toFixed(2)} · portables en la cola ${st.slice(CORTE).flatMap(s=>s.vocab).filter((v:any)=>PORT.has(v.type)).length}`);
let mudadas=0, recicladas=0, sueltas=0;

// 1. mudar lo portable de la cola hacia la cabeza
for (let i=CORTE;i<st.length;i++) {
  const s=st[i];
  for (const v of [...s.vocab]) {
    if (!PORT.has(v.type)) continue;
    if (veces(String(v.word).toLowerCase())>1) continue;      // ya es reciclado, se queda
    const destino = st.slice(0,CORTE).map((d,k)=>({d,k}))
      .filter(({d,k}) => d.vocab.length < techo(d)
        && !d.vocab.some((x:any)=>raiz(String(x.word))===raiz(String(v.word)))
        && formas(v).some((f:string)=>cuerpos[k].has(f)) )
      .sort((a,b)=>a.d.vocab.length-b.d.vocab.length)[0];
    if (!destino) { sueltas++; continue; }
    const forma = formas(v).find((f:string)=>cuerpos[destino.k].has(f))!;
    s.vocab = s.vocab.filter((x:any)=>x!==v);
    destino.d.vocab.push({ ...v, surface: forma });
    if (reparto(destino.d,destino.k) > 0.30) { destino.d.vocab.pop(); s.vocab.push(v); sueltas++; continue; }
    mudadas++;
  }
}
// 2. rellenar la cola con el 4o encuentro de portables de la cabeza
for (let i=CORTE;i<st.length;i++) {
  const s=st[i];
  // La cola sube hasta el techo reciclando: es lo que la curva pide, vocabulario
  // nuevo descendente y ultimas historias que casi solo vuelven sobre lo visto.
  while (s.vocab.length < techo(s)) {
    const mias=new Set(s.vocab.map(sup));
    const raices=new Set(s.vocab.map((v:any)=>raiz(String(v.word))));
    const cand = st.slice(0,CORTE).flatMap(d=>d.vocab)
      .filter((v:any)=>PORT.has(v.type) && !raices.has(raiz(String(v.word)))
        && veces(String(v.word).toLowerCase())===1)
      .map((v:any)=>({v, f: formas(v).find((f:string)=>cuerpos[i].has(f) && !mias.has(f))}))
      .filter((x:any)=>!!x.f)
      .sort((a:any,b:any)=>cuenta(b.f)-cuenta(a.f))[0];
    if (!cand) break;
    const antes = reparto(s,i);
    s.vocab.push({...cand.v, surface: cand.f});
    // Una historia que ya incumple el reparto solo sale del pozo anadiendo
    // plazas fuera del bloque lleno: el tope es una proporcion y el
    // denominador crece. Se acepta si cumple, o si al menos mejora.
    const ahora = reparto(s,i);
    if (ahora > 0.30 && ahora >= antes) { s.vocab.pop(); break; }
    recicladas++;
  }
}
console.log(`${mudadas} portables mudadas a la 1-15 · ${recicladas} recicladas en la cola · ${sueltas} sin sitio`);
console.log(`despues: media ${media().toFixed(2)}`);
console.log("cola:", st.slice(CORTE).map((s,k)=>{
  const e=s.vocab.map((v:any)=>cuenta(sup(v)));
  return `${CORTE+k+1}:${(e.reduce((a:number,b:number)=>a+b,0)/e.length).toFixed(2)}(${s.vocab.length})`;
}).join(" "));
if (process.argv.includes("--apply")) fs.writeFileSync(file, JSON.stringify(st,null,1));
