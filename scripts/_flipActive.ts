import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const j = await prisma.journey.findUnique({ where:{ id:"cmr92f0qz000032ff1dfd4fgx" }, select:{ id:true, status:true, name:true, language:true, variant:true } }) as any;
  console.log("ANTES:", j.name, "|", j.language, j.variant, "| status:", j.status);
  const upd = await prisma.journey.update({ where:{ id:j.id }, data:{ status:"active" }, select:{ status:true } });
  console.log("AHORA: status:", upd.status);
  const pub = await prisma.journeyStory.count({ where:{ journeyId:j.id, status:"published" } });
  const otherDE = await prisma.journey.findMany({ where:{ language:j.language, status:{ not:"archived" }, id:{ not:j.id } }, select:{ name:true, status:true } });
  console.log("historias publicadas visibles:", pub);
  console.log("otros journeys DE no-archivados (deberían ser 0):", otherDE.length, otherDE.map((x:any)=>x.name).join(","));
})().finally(() => prisma.$disconnect());
