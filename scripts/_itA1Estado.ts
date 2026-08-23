/** Estado del journey leido de la BASE: historias, practica y glosas. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function run(){
  const id="cmt5wqsf7000032ghesowd0jy";
  const j=await prisma.journey.findUnique({where:{id},select:{topics:true,status:true,nextJourneyId:true}});
  const rows=(await prisma.journeyStory.findMany({where:{journeyId:id},
    select:{topic:true,slotIndex:true,slug:true,vocab:true,practiceSet:{select:{id:true,exercises:{select:{id:true,featured:true}}}}}}))
    .sort((a,b)=>(j!.topics.indexOf(a.topic)-j!.topics.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  const gl=JSON.parse(fs.readFileSync("src/data/tapGlosses/italian-traveler-a1.json","utf8"));
  let ex=0, feat=0, sets=0;
  for (const r of rows) for (const s of (r.practiceSet ? [r.practiceSet] : [])) { sets++; ex+=s.exercises.length; feat+=s.exercises.filter(e=>e.featured).length; }
  console.log(`journey ${j!.status} · next=${j!.nextJourneyId ? "si" : "no"}`);
  console.log(`historias ${rows.length} · plazas ${rows.reduce((n,r)=>n+((r.vocab as any[])??[]).length,0)}`);
  console.log(`practica: ${sets} sets · ${ex} ejercicios · ${feat} featured · sin set: ${rows.filter(r=>!r.practiceSet).map(r=>r.slug).join(", ")||"ninguna"}`);
  console.log(`glosas: ${Object.keys(gl.glosses).length} en el bundle · ${gl.slugs.length} slugs`);
  await prisma.$disconnect();
}
run();
