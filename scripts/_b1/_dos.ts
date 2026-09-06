import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmt5x67ze000l320cpgunu5vi",
             slug: { in: ["cada-uno-dice-lo-suyo", "el-plastico-no-arregla-nada", "rosa-cuenta-las-docenas"] } },
    select: { slug: true, title: true, synopsis: true, text: true, vocab: true },
  });
  for (const s of ss) {
    console.log(`\n##### ${s.slug} | ${s.title}\n${s.text}`);
    console.log("VOCAB: " + (s.vocab as Array<{word:string;surface?:string}>).map((v)=>v.surface??v.word).join(", "));
  }
  await p.$disconnect();
})();
