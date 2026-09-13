/** Solo lectura: cuantos lemas de FRENCH_A1_A2_LEMMAS quedan sin ensenar en los journeys franceses no archivados. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma"; import { FRENCH_A1_A2_LEMMAS, isFrenchA1A2 } from "../src/lib/cefr/frenchA1A2";
const p = new PrismaClient();
const strip=(w:string)=>w.toLowerCase().trim().replace(/^(le|la|les|un|une|des|du)\s+/,"").replace(/^l['’]/,"").replace(/^(se |s'|s’)/,"");
async function main() {
  const js = await p.journey.findMany({ where:{ language:"french", status:{not:"archived"} }, select:{id:true,name:true,levels:true,typeSlug:true}});
  const taughtSame = new Set<string>(), taughtOther = new Set<string>(); let inList=0,total=0;
  for (const j of js) { const st = await p.journeyStory.findMany({where:{journeyId:j.id},select:{vocab:true}});
    for (const s of st) for (const v of (s.vocab as any[]??[])) { const k=strip(v.word); (j.typeSlug==="relationships"?taughtSame:taughtOther).add(k); if (j.typeSlug==="relationships"){ total++; if (isFrenchA1A2(v.word)) inList++; } } }
  const lemmas=[...FRENCH_A1_A2_LEMMAS];
  const libres = lemmas.filter(l=>!taughtSame.has(l) && !taughtOther.has(l));
  const soloOtro = lemmas.filter(l=>!taughtSame.has(l) && taughtOther.has(l));
  console.log("lemas en lista:", lemmas.length, "| Friends A0+A1 plazas:", total, "en lista:", inList);
  console.log("libres del todo:", libres.length, "| solo ensenados por Expat (otro tipo):", soloOtro.length, "| ya ensenados por Friends:", lemmas.filter(l=>taughtSame.has(l)).length);
  console.log("LIBRES:", libres.join(", "));
  await p.$disconnect();
}
main();
