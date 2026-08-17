import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const JHENNY = "FXGrCtY3PEyfqczBAlqm";
(async () => {
  const j = await prisma.journey.findFirst({ where: { status: "active", levels: { has: "a0" } }, select: { id: true } });
  const r = await prisma.journeyStory.updateMany({ where: { journeyId: j!.id, status: "published" }, data: { practiceVoiceId: JHENNY } });
  console.log(`practiceVoiceId=Jhenny on ${r.count} A0 stories`);
  const s = await prisma.journeyStory.findFirst({ where: { slug: "el-mercado-picante" }, select: { text: true, vocab: true, voiceId: true } });
  console.log("--- VOCAB ---");
  for (const w of (s?.vocab as any[]) || []) console.log(`- ${w.word} | ${w.surface ?? ""} | ${w.type ?? ""} | ${w.def ?? w.translation ?? ""} | EX: ${w.ex ?? w.exampleSentence ?? ""}`);
  console.log("--- TEXT ---"); console.log(s?.text);
})().finally(() => prisma.$disconnect());
