import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const js = await p.journey.findMany({ where: { language: "german" }, select: { id:true, name:true, variant:true, levels:true, status:true, _count:{select:{stories:true}} }, orderBy:{createdAt:"asc"} });
  for (const j of js) console.log(`${j.status.padEnd(9)} | ${j.name} | var=${j.variant} | levels=${JSON.stringify(j.levels)} | stories=${(j as any)._count.stories} | ${j.id}`);
})().finally(()=>p.$disconnect());
