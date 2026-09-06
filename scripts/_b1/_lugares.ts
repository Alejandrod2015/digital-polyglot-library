import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const RE = /\b(Nerja|Frigiliana|M[áa]laga|Madrid|levante|malec[óo]n|mar|muelle|playa|barcas?|puerto|costa|pueblo|cerro|sierra)\b/i;
(async () => {
  const ss = await p.journeyStory.findMany({ where: { journeyId: "cmt5x67ze000l320cpgunu5vi" },
    select: { slug: true, text: true }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
  for (const s of ss) {
    const hits = s.text.split(/(?<=[.!?”])\s+/).filter((o) => RE.test(o));
    console.log(`\n${s.slug}  (${hits.length})`);
    for (const h of hits) console.log("   " + h.trim());
  }
  await p.$disconnect();
})();
