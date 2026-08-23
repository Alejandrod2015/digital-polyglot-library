/** Diagnostico de la escalera de recirculacion. Solo lectura. */
import * as fs from "fs";
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const st = (JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[])
  .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = st.map(s => new Set(tok(s.text)));
const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
const enc: Array<{w:string,s:string,n:number,slug:string}> = [];
for (const s of st) for (const v of s.vocab)
  enc.push({ w: v.word, s: clave(v), n: cuerpos.filter(c=>c.has(clave(v))).length, slug: s.slug });
const media = enc.reduce((a,b)=>a+b.n,0)/enc.length;
console.log(`plazas ${enc.length} · media ${media.toFixed(2)} · una sola vez ${enc.filter(e=>e.n<=1).length}`);
console.log(`para llegar a 2.5 hacen falta ${Math.ceil(2.5*enc.length - enc.reduce((a,b)=>a+b.n,0))} apariciones mas\n`);

// Que formas del MISMO lema ya aparecen en otros cuerpos: cuanto se recupera solo
// eligiendo mejor la superficie.
const raiz = (w: string) => w.slice(0, Math.max(4, w.length - 3));
let ganancia = 0;
const mejorables: string[] = [];
for (const e of enc) {
  const r = raiz(e.s);
  const n2 = cuerpos.filter(c => [...c].some(t => t.startsWith(r))).length;
  if (n2 > e.n) { ganancia += n2 - e.n; mejorables.push(`${e.s}(${e.n}->${n2})`); }
}
console.log(`Cambiando la superficie a la forma mas frecuente se ganarian ${ganancia} apariciones:`);
console.log(mejorables.slice(0,60).join(" ") + (mejorables.length>60?` …+${mejorables.length-60}`:""));

// Palabras del corpus que YA se repiten mucho (candidatas a nucleo portable)
const freq = new Map<string, number>();
for (const c of cuerpos) for (const t of c) freq.set(t, (freq.get(t) ?? 0) + 1);
const ense = new Set(enc.map(e=>e.s));
console.log(`\nTokens en 4+ cuerpos que NO son superficie de ninguna plaza:`);
console.log([...freq].filter(([t,n])=>n>=4 && !ense.has(t) && t.length>3).sort((a,b)=>b[1]-a[1]).map(([t,n])=>`${t}:${n}`).join(" "));
console.log(`\nPlazas con 1 sola aparicion (${enc.filter(e=>e.n<=1).length}):`);
console.log(enc.filter(e=>e.n<=1).map(e=>e.s).join(" "));
