import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ss = await p.journeyStory.findMany({ where: { journeyId: "cmt5x67ze000l320cpgunu5vi" }, select: { slug: true, text: true } });
  for (const t of ["Álvaro", "huerto", "semillas", "tres llaves", "rompió en octubre"]) {
    const hits = ss.filter((s) => s.text.includes(t));
    console.log(t.padEnd(18), `${hits.length}/21`, hits.map((h) => h.slug).join(", "));
  }
  await p.$disconnect();
})();
