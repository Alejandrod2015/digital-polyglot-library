// Prueba del gate de lote: exporta 3 historias reales de un journey a un JSON
// con el formato de saveStory, para pasarlas por el validador de verdad.
import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const [lang, variant, out] = [process.argv[2], process.argv[3], process.argv[4]];
  const j = await p.journey.findFirst({ where:{ language:{ equals:lang, mode:"insensitive" }, variant, status:{ notIn:["archived","draft"] } }, select:{ id:true } });
  const st = await p.journeyStory.findMany({ where:{ journeyId:j!.id, status:"published" }, select:{ title:true, synopsis:true, text:true, vocab:true, arcType:true, topic:true, slotIndex:true }, orderBy:{ slotIndex:"asc" }, take:3 });
  writeFileSync(out, JSON.stringify(st, null, 1));
  console.log(`${out}: ${st.length} historias de ${lang}/${variant}`);
})().finally(()=>p.$disconnect());
