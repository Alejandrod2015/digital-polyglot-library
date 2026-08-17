import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const slug=process.argv[2];
  const st=await p.journeyStory.findFirst({where:{slug}, select:{practiceSet:{select:{exercises:{select:{type:true, payload:true}}}}}});
  const exs=st?.practiceSet?.exercises??[];
  let need=0, withUrl=0; const t:Record<string,number>={};
  for(const e of exs){ const clip=(e.payload as any)?.audioClip?.clipUrl; if(e.type==="meaning_in_context"||e.type==="fill_blank"){ need++; if(typeof clip==="string"&&clip) withUrl++; } t[e.type]=(t[e.type]||0)+1; }
  console.log(`${slug}: types=${JSON.stringify(t)} | need clip=${need} | WITH clipUrl=${withUrl}`);
})().finally(()=>p.$disconnect());
