import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const j = await prisma.journey.findFirst({ where: { status: "active", levels: { has: "a1" } }, select: { id: true } });
  const r = await prisma.journeyStory.updateMany({ where: { journeyId: j!.id, status: "published" }, data: { practiceVoiceId: "FXGrCtY3PEyfqczBAlqm" } });
  console.log(`practiceVoiceId=Jhenny on ${r.count} A1 stories`);
  const s = await prisma.journeyStory.findFirst({ where: { slug: "sabado-de-mercado" }, select: { vocab: true } });
  for (const w of ((s?.vocab as any[]) || []).slice(0, 6)) console.log(JSON.stringify(w));
})().finally(() => prisma.$disconnect());
