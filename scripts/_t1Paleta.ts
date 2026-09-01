import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { createRequire } from "module";
import * as fs from "fs";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const lema=(w:string)=>w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
(async()=>{
  const { SPANISH_A1_A2_LEMMAS } = await import("@/lib/cefr/spanishA1A2");
  const J="cmtgelq560007j84n3ujx9bpd";
  const rows=await p.journeyStory.findMany({where:{journey:{is:{language:"spanish",status:{not:"archived"}}}},select:{vocab:true,journeyId:true,journey:{select:{typeSlug:true}}}});
  const PORTABLES=new Set(["verb","adjective","adverb","expression"]);
  const duro=new Set<string>(), blando=new Set<string>();
  for(const r of rows){
    const own=r.journeyId===J;
    for(const v of ((r.vocab as any[])??[])) if(v?.word){
      // Mismo prefiltro portable que saveStory.ts: la capa portable se reabre
      // entre journeys, pero NO dentro de este mismo journey.
      if(!own && PORTABLES.has(String(v.type??"").toLowerCase())) continue;
      if(own||r.journey?.typeSlug==="traveler") duro.add(lema(String(v.word))); else blando.add(lema(String(v.word)));
    }
  }
  const pal=[...SPANISH_A1_A2_LEMMAS].map(lema).filter(w=>!duro.has(w)).sort();
  const libres=pal.filter(w=>!blando.has(w));
  fs.writeFileSync("/tmp/t1-paleta.txt", pal.join("\n"));
  fs.writeFileSync("/tmp/t1-libres.txt", libres.join("\n"));
  fs.writeFileSync("/tmp/t1-duro.txt", [...duro].sort().join("\n"));
  console.log(`bloqueados (tolerancia cero): ${duro.size} · paleta A1A2 libre: ${pal.length} · de ellas libres del todo: ${libres.length}`);
})().finally(()=>p.$disconnect());
