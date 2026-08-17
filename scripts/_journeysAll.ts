import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const js = await prisma.journey.findMany({ select: { name: true, language: true, variant: true, levels: true, status: true, _count: { select: { stories: true } } } });
  for (const j of js) console.log(`${j.language}/${j.variant ?? "-"} ${JSON.stringify(j.levels)} status=${j.status} historias=${j._count.stories} (${j.name})`);
})().finally(() => prisma.$disconnect());
