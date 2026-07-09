import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const MORITZ="Ww7Sq9tx9CCOiNOwWgsx";
  const r=await p.journeyStory.updateMany({where:{journeyId:"cmrdbz11t000032asrvo832i9"}, data:{practiceVoiceId:MORITZ}});
  console.log("practiceVoiceId set on", r.count);
  const ids=(await p.journeyStory.findMany({where:{journeyId:"cmrdbz11t000032asrvo832i9"}, select:{id:true}})).map(x=>x.id);
  const cnt:any=await p.$queryRawUnsafe(`SELECT count(*)::int AS n FROM dp_story_practice_sets_v1 WHERE "storyId" = ANY($1)`, ids);
  console.log("practice sets sembrados:", cnt[0].n, "/ 21");
})().finally(()=>p.$disconnect());
