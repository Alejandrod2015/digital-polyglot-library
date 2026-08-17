import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const J = "cmovi4cvi000032q37a4823h3";
(async () => {
  const j = await prisma.journey.findUnique({ where: { id: J }, select: { name: true, levels: true, topics: true, status: true } });
  console.log("JOURNEY:", j?.name, "| levels=", j?.levels, "| status=", j?.status);
  const grp = await prisma.journeyStory.groupBy({ by: ["level", "status"], where: { journeyId: J }, _count: true });
  console.log("\nstory level x status:");
  for (const g of grp) console.log(`  ${g.level} / ${g.status}: ${g._count}`);
  const s = await prisma.journeyStory.findFirst({ where: { journeyId: J, slug: "sabado-de-mercado" }, select: { status: true, audioStatus: true, audioUrl: true, coverUrl: true, coverDone: true } });
  console.log("\nsabado-de-mercado:", JSON.stringify(s, null, 2));
  await prisma.$disconnect();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
