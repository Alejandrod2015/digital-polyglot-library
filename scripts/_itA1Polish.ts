/**
 * Pulido final: quita SOLO segundas plazas (nunca la primera de una palabra)
 * hasta que cada historia cumpla el reparto por bloques del lector y el tope de
 * dos palabras venidas de un journey de OTRO tipo.
 */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
const prisma = new PrismaClient();
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const PORT = new Set(["verb","adjective","adverb","expression"]);
const file = "scripts/_itA1/ALL.json";
async function run(){
  const st = (JSON.parse(fs.readFileSync(file,"utf8")) as any[])
    .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  const fr = "cmrsiz1n40000320d6h8p8f5g";
  const rows = await prisma.journeyStory.findMany({ where: { journeyId: fr }, select: { vocab:true } });
  const F = new Set<string>();
  for (const r of rows) for (const v of ((r.vocab as any[])??[])) F.add(String(v.word).toLowerCase());
  const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]) as string[];
  const cuerpos = st.map(s=>new Set(tok(s.text)));
  const sup=(v:any)=>String(v.surface??v.word).toLowerCase();
  const cuenta=(t:string)=>cuerpos.filter(c=>c.has(t)).length;
  const veces = new Map<string,number>();
  for (const s of st) for (const v of s.vocab) veces.set(String(v.word).toLowerCase(), (veces.get(String(v.word).toLowerCase())??0)+1);
  const media=()=>{const e=st.flatMap(s=>s.vocab.map((v:any)=>cuenta(sup(v))));return e.reduce((a,b)=>a+b,0)/e.length;};
  console.log(`antes: media ${media().toFixed(2)} sobre ${st.flatMap(s=>s.vocab).length} plazas`);
  let quitados=0;
  for (const s of st) {
    for (let paso=0; paso<12; paso++) {
      const bl = renderedParagraphs(s.text);
      const per = bl.map(b=>s.vocab.filter((v:any)=>b.includes(v.surface??v.word)));
      const peor = per.reduce((a,b)=>a.length>=b.length?a:b, [] as any[]);
      const conc = s.vocab.length ? peor.length/s.vocab.length : 0;
      const otros = s.vocab.filter((v:any)=>F.has(String(v.word).toLowerCase()));
      const necesitaBloque = conc > 0.30 && s.vocab.length > 20;
      const necesitaOtros = otros.length > 2 && s.vocab.length > 20;
      if (!necesitaBloque && !necesitaOtros) break;
      // Solo se quita una SEGUNDA plaza: la palabra sigue enseñada en su historia.
      const pool = (necesitaBloque ? peor : otros)
        .filter((v:any)=>(veces.get(String(v.word).toLowerCase())??1) > 1)
        .sort((a:any,b:any)=>cuenta(sup(a))-cuenta(sup(b)));
      const fuera = pool[0] ?? (necesitaOtros ? otros.filter((v:any)=>PORT.has(v.type)).sort((a:any,b:any)=>cuenta(sup(a))-cuenta(sup(b)))[0] : undefined);
      if (!fuera) break;
      s.vocab = s.vocab.filter((x:any)=>x!==fuera);
      veces.set(String(fuera.word).toLowerCase(), (veces.get(String(fuera.word).toLowerCase())??1)-1);
      quitados++;
    }
  }
  console.log(`${quitados} segundas plazas retiradas · media ${media().toFixed(2)} sobre ${st.flatMap(s=>s.vocab).length} plazas`);
  if (process.argv.includes("--apply")) fs.writeFileSync(file, JSON.stringify(st,null,1));
  await prisma.$disconnect();
}
run();
