import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const A2 = "cmt70xfyt000l3283gxd70wck", B1 = "cmt5x67ze000l320cpgunu5vi";
(async () => {
  for (const [nom, id] of [["A2", A2], ["B1", B1]] as const) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: id },
      select: { topic: true, slotIndex: true, slug: true, text: true },
      orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
    console.log(`\n##### ${nom}: primera y ultima frase de cada una`);
    for (const s of ss) {
      const fr = s.text.split(/(?<=[.!?”])\s+/).map((x) => x.trim()).filter(Boolean);
      console.log(`${s.slug}`);
      console.log(`   A> ${fr[0]}`);
      console.log(`   Z> ${fr[fr.length - 1]}`);
    }
  }
  await p.$disconnect();
})();
