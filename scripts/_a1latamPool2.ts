import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { SPANISH_A1_A2_LEMMAS } from "../src/lib/cefr/spanishA1A2";
const p = new PrismaClient();
const norm=(w:string)=>w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
(async()=>{
  const js = await p.journey.findMany({ where:{ language:"spanish", status:{ not:"archived" } } });
  const dura=new Set<string>(), blanda=new Set<string>();
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where:{ journeyId:j.id }, select:{ vocab:true } });
    const dest = j.typeSlug === "traveler" ? dura : blanda;
    for (const s of st) for (const v of (((s.vocab as any[])??[]))) if (v?.word) dest.add(norm(String(v.word)));
  }
  const libre = [...SPANISH_A1_A2_LEMMAS].filter((w)=>!dura.has(norm(w)) && !blanda.has(norm(w)));
  console.log(`A1A2 ${SPANISH_A1_A2_LEMMAS.size} · duras ${dura.size} · blandas ${blanda.size} · LIBRE TOTAL ${libre.length}`);
  console.log(libre.sort().join(" | "));
  await p.$disconnect();
})();
