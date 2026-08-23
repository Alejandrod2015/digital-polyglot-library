/** ¿Cuantas palabras A0/A1 alemanas quedan LIBRES para montar la escalera?
 *  Cruza la lista de nivel del proyecto contra lo que ya ensenan el A1 aleman
 *  (mismo tipo, tope cero) y los journeys de otro tipo. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as lista from "../../src/lib/cefr/germanA1A2";
const p = new PrismaClient();
const SEP=["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"], COM=["ge","ver","be","er","ent"], ART=["der ","die ","das "];
function sp(w:string){let l=w.toLowerCase();for(const a of ART)if(l.startsWith(a)){l=l.slice(a.length);break;}
  for(const q of [...SEP,...COM])if(l.startsWith(q)&&l.length>q.length+3)return l.slice(q.length);return l;}
const lema=(w:string)=>sp(w).normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
(async()=>{
  const exp = Object.entries(lista as Record<string, unknown>)
    .filter(([,v])=>Array.isArray(v)||v instanceof Set)
    .map(([k,v])=>[k, Array.isArray(v)?v.length:(v as Set<string>).size] as const);
  console.log("exports con lemas:", exp.map(([k,n])=>`${k}=${n}`).join(" "));
  const todos = new Set<string>();
  for (const [,v] of Object.entries(lista as Record<string, unknown>)) {
    const arr = Array.isArray(v) ? v : (v instanceof Set ? [...v] : []);
    for (const w of arr) if (typeof w === "string") todos.add(lema(w));
  }
  const J="cmt0a8vb1000m32p1x7r5ba28";
  const mio = await p.journey.findUnique({ where:{id:J}, select:{language:true, typeSlug:true}});
  const otras = await p.journeyStory.findMany({
    where:{ journey:{ language:mio!.language, status:{not:"archived"} }, journeyId:{not:J} },
    select:{ vocab:true, journey:{select:{typeSlug:true}} }});
  const duro=new Set<string>(), blando=new Set<string>();
  for(const r of otras){ const d = r.journey?.typeSlug===mio!.typeSlug ? duro : blando;
    for(const v of ((r.vocab as any[])??[])) if(v?.word) d.add(lema(String(v.word))); }
  const libres=[...todos].filter(w=>!duro.has(w)&&!blando.has(w));
  console.log(`lista de nivel aleman: ${todos.size} lemas`);
  console.log(`  ocupados por el A1 (mismo tipo): ${[...todos].filter(w=>duro.has(w)).length}`);
  console.log(`  ocupados por otros tipos: ${[...todos].filter(w=>blando.has(w)&&!duro.has(w)).length}`);
  console.log(`  LIBRES: ${libres.length}`);
  console.log(`hacen falta ~200 recurrentes + ~150 ancladas de escena`);
  await p.$disconnect();
})();
