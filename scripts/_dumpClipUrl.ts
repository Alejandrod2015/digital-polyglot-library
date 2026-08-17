import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
type MP = { pairs?: Array<{ word?: string; wordClipUrl?: string | null }> };
(async()=>{
  const e=await p.storyPracticeExercise.findFirst({where:{type:"match_meaning",set:{story:{journey:{language:{equals:"portuguese",mode:"insensitive"}}}}},select:{payload:true}});
  for (const par of ((e!.payload as MP).pairs ?? []).slice(0,2)) console.log(`${par.word}\t${par.wordClipUrl}`);
})().finally(()=>p.$disconnect());
