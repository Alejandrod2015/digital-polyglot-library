import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findUnique({
    where: { id: "cmt5x686y000n320cyme6dmrl" },
    select: { text: true, vocab: true },
  });
  const v = (s?.vocab as any[]) ?? [];
  console.log("VOCAB de la historia 1:");
  for (const w of v) console.log(" -", JSON.stringify({ word: w.word, surface: w.surface, type: w.type, def: w.definition ?? w.def }));
  console.log("\nlineas con 'cerrad':");
  for (const l of String(s?.text).split(/\n+/)) if (/cerrad/i.test(l)) console.log("  *", l.trim());
  await p.$disconnect();
})();
