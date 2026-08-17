import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const rows=await p.journeyStory.findMany({where:{journeyId:"cmrdqk484000032r4rt2vw4ej"},select:{slug:true,dialogueSpec:true}});
  const withSpec=rows.filter(r=>Array.isArray(r.dialogueSpec)&&(r.dialogueSpec as any[]).length).length;
  console.log(`dialogueSpec set: ${withSpec}/${rows.length}`);
  const ex=rows.find(r=>r.slug==="se-dano-la-parranda");
  console.log("se-dano-la-parranda (T4, con Guachimán):", JSON.stringify(ex?.dialogueSpec));
})().finally(()=>p.$disconnect());
