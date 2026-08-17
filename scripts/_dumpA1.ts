import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const J = "cmovi4cvi000032q37a4823h3";
(async () => {
  const s = await prisma.journeyStory.findFirst({ where: { journeyId: J, slug: "la-combi-equivocada" }, select: { level: true, vocab: true, text: true } });
  const v: any[] = Array.isArray(s?.vocab) ? (s!.vocab as any) : [];
  console.log(`level=${s?.level} | ${v.length} vocab:`);
  for (const it of v) console.log(`  ${(it.word||"").padEnd(16)} [${it.type}] surf=${it.surface??"-"} :: ${it.definition}`);
  console.log("\n===== TEXTO =====\n" + s?.text);
  await prisma.$disconnect();
})();
