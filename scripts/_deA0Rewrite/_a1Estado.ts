import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const A="cmqfnp3tf000032afygkqp8z2";
  const j = await p.journey.findUnique({ where:{id:A}, select:{ name:true, status:true, levels:true, topics:true, createdAt:true, updatedAt:true }});
  console.log(JSON.stringify(j));
  const ss = await p.journeyStory.findMany({ where:{journeyId:A}, select:{ status:true, text:true, coverUrl:true, audioUrl:true, vocab:true, practiceSet:{select:{id:true}} }});
  console.log("historias", ss.length,
    "| con texto", ss.filter(s=>s.text).length,
    "| publicadas", ss.filter(s=>s.status==="published").length,
    "| portada", ss.filter(s=>s.coverUrl).length,
    "| audio", ss.filter(s=>s.audioUrl).length,
    "| sets", ss.filter(s=>s.practiceSet).length);
  await p.$disconnect();
})();
