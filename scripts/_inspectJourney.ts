import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const j = await prisma.journey.findUnique({ where:{ id:"cmr92f0qz000032ff1dfd4fgx" } }) as any;
  console.log("CAMPOS del journey Expat:");
  for (const k of Object.keys(j)) {
    const v=j[k]; if(typeof v==="object"&&v!==null) console.log(`  ${k}: ${JSON.stringify(v).slice(0,120)}`);
    else console.log(`  ${k}: ${v}`);
  }
  // niveles distintos en sus historias
  const lv = await prisma.journeyStory.groupBy({ by:["level"], where:{ journeyId:j.id, status:"published" }, _count:true });
  console.log("\nniveles de las historias publicadas:", JSON.stringify(lv));
})().finally(() => prisma.$disconnect());
