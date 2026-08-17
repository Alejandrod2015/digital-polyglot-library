import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient, Prisma } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const r = await p.journeyStory.updateMany({
    where: { slug: { in: process.argv.slice(2) } },
    data: { audioFragments: Prisma.DbNull },
  });
  console.log(`fragmentos viejos limpiados en ${r.count} historia(s)`);
})().finally(()=>p.$disconnect());
