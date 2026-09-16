import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s: any = await p.journeyStory.findFirst({ where: { slug: process.argv[2] },
    select: { slug:true, practiceSet:{ select:{ exercises:{ select:{word:true,type:true,payload:true} } } } } });
  const ex = s.practiceSet.exercises;
  const mic = ex.filter((e:any)=>e.type==="meaning_in_context");
  const fb = ex.filter((e:any)=>e.type==="fill_blank");
  console.log("ejercicios:", ex.length, "| tipos:", [...new Set(ex.map((e:any)=>e.type))].join(","));
  console.log("meaning_in_context:", mic.length, "con wordClipUrl:", mic.filter((e:any)=>e.payload?.audioClip?.wordClipUrl).length, "con clipUrl frase:", mic.filter((e:any)=>e.payload?.audioClip?.clipUrl).length);
  console.log("fill_blank:", fb.length, "con clipUrl:", fb.filter((e:any)=>e.payload?.audioClip?.clipUrl).length);
  await p.$disconnect();
})();
