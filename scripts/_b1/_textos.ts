import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const ss = await p.journeyStory.findMany({ where: { journeyId: "cmt5x67ze000l320cpgunu5vi" },
    select: { slug: true, title: true, text: true }, orderBy: { slug: "asc" } });
  const out: Record<string, string> = {};
  for (const s of ss) out[s.slug!] = `${s.title}. ${s.text}`;
  fs.writeFileSync("scripts/_b1/g/textos.json", JSON.stringify(out, null, 1));
  console.log(Object.keys(out).length, "historias");
  await p.$disconnect();
})();
