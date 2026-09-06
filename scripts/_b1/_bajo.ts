import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const id of ["cmt5x67ze000l320cpgunu5vi", "cmt70xfyt000l3283gxd70wck"]) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: id }, select: { slug: true, text: true } });
    console.log(`\n### ${id === "cmt5x67ze000l320cpgunu5vi" ? "B1" : "A2"}: frases con "bajo" como vivienda`);
    for (const s of ss)
      for (const o of s.text.split(/(?<=[.!?”])\s+/))
        if (/\b(del|el|al|en el) bajo\b/i.test(o)) console.log(`  ${s.slug.padEnd(30)} ${o.trim()}`);
  }
  await p.$disconnect();
})();
