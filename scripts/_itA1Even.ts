/**
 * Reparte las plazas por los cuatro bloques que pinta el lector.
 *
 * `narrator-block-distribution` bloquea cuando un bloque se lleva mas del 30%
 * de las plazas de la historia, y medirlo sobre el RENDER es lo correcto: es lo
 * que el alumno ve. El rebalanceo a portables las amontono donde estaban los
 * verbos. Aqui, mientras un bloque pase del tope, se cambia una portable de ese
 * bloque por otra que viva en el bloque mas vacio. Las ancladas no se tocan.
 */
import * as fs from "fs";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const PORT = new Set(["verb","adjective","adverb","expression"]);
const file = "scripts/_itA1/ALL.json";
const dic = JSON.parse(fs.readFileSync("scripts/_itA1/portables.json","utf8")) as Record<string,{type:string,forms:string[],def:string}>;
const st = (JSON.parse(fs.readFileSync(file,"utf8")) as any[])
  .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]) as string[];
const cuerpos = st.map(s=>new Set(tok(s.text)));
const sup=(v:any)=>String(v.surface??v.word).toLowerCase();
const cuenta=(t:string)=>cuerpos.filter(c=>c.has(t)).length;
const raiz=(w:string)=>w.toLowerCase().slice(0,5);
const usados = new Set(st.flatMap(s=>s.vocab.map((v:any)=>String(v.word).toLowerCase())));
const media=()=>{const e=st.flatMap(s=>s.vocab.map((v:any)=>cuenta(sup(v))));return e.reduce((a,b)=>a+b,0)/e.length;};
console.log(`antes: media ${media().toFixed(2)}`);
let cambios=0, quitados=0;
for (const [i,s] of st.entries()) {
  for (let paso=0; paso<16; paso++) {
    const bl = renderedParagraphs(s.text);
    const per = bl.map(b=>s.vocab.filter((v:any)=>b.includes(v.surface??v.word)));
    const idxMax = per.reduce((a,b,k)=>per[a].length>=b.length?a:k,0);
    const idxMin = per.reduce((a,b,k)=>per[a].length<=b.length?a:k,0);
    if (per[idxMax].length / s.vocab.length <= 0.30) break;
    const raices = new Set(s.vocab.map((v:any)=>raiz(String(v.word))));
    // Candidata: portable con ficha, sin usar, que viva SOLO en el bloque flaco.
    const cand = Object.entries(dic)
      .filter(([lema]) => !usados.has(lema) && !raices.has(raiz(lema)))
      .map(([lema,f]) => ({ lema, f, forma: f.forms.find(x=>bl[idxMin].toLowerCase().includes(x) && cuerpos[i].has(x)) }))
      .filter(x => !!x.forma && !bl[idxMax].toLowerCase().includes(x.forma!) && !raices.has(raiz(x.forma!)))
      .map(x => ({...x, n: cuenta(x.forma!)})).sort((a,b)=>b.n-a.n)[0];
    // La que sale es una portable del bloque lleno, la que menos se reencuentra.
    const fuera = per[idxMax].filter((v:any)=>PORT.has(v.type))
      .sort((a:any,b:any)=>cuenta(sup(a))-cuenta(sup(b)))[0];
    if (!fuera) break;
    s.vocab = s.vocab.filter((x:any)=>x!==fuera);
    usados.delete(String(fuera.word).toLowerCase());
    if (cand) {
      s.vocab = s.vocab.concat([{ word: cand.lema, surface: cand.forma, type: cand.f.type, definition: cand.f.def }]);
      usados.add(cand.lema); cambios++;
    } else quitados++;
    if (s.vocab.length < 20) break;
  }
}
console.log(`${cambios} portables movidas de bloque · ${quitados} retiradas · media ${media().toFixed(2)} sobre ${st.flatMap(s=>s.vocab).length}`);
if (process.argv.includes("--apply")) fs.writeFileSync(file, JSON.stringify(st,null,1));
