import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const s = await p.journeyStory.findFirst({ where:{ slug:"a-ultima-barca-para-niteroi" }, select:{ dialogueSpec:true, audioFragments:true } });
  const spec = s?.dialogueSpec as Array<{speaker?:string;voice?:string;text?:string}> | null;
  console.log("dialogueSpec:", spec ? `${spec.length} segmentos` : "null");
  if (spec) spec.slice(0,3).forEach((x,i)=>console.log(`  [${i}] speaker=${x.speaker} voice=${x.voice} · ${(x.text??"").slice(0,60)}`));
  const fr = s?.audioFragments as unknown[] | null;
  console.log("audioFragments:", fr ? `${fr.length}` : "null");
})().finally(()=>p.$disconnect());
