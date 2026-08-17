import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const JHENNY = "FXGrCtY3PEyfqczBAlqm";
(async () => {
    const s = await prisma.journeyStory.findFirst({ where: { slug: "ana-es-la-guia" }, select: { text: true, vocab: true, voiceId: true } });
  console.log("--- VOCAB ---");
  for (const w of (s?.vocab as any[]) || []) console.log(`- ${w.word} | ${w.surface ?? ""} | ${w.type ?? ""} | ${w.def ?? w.translation ?? ""} | EX: ${w.ex ?? w.exampleSentence ?? ""}`);
  console.log("--- TEXT ---"); console.log(s?.text);
})().finally(() => prisma.$disconnect());
