import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: "cmt5x67ze000l320cpgunu5vi", topic: "rooms-and-landlords" },
    select: { slotIndex: true, title: true, vocab: true }, orderBy: { slotIndex: "asc" } });
  const libres: string[] = [];
  for (const r of rows) {
    const w = ((r.vocab as Array<{ word: string }>) ?? []).map((v) => v.word);
    console.log(`#${r.slotIndex} ${r.title}: ${w.join(", ")}`);
    libres.push(...w);
  }
  console.log(`\nlibera ${libres.length} palabras para el tema 1`);
  await p.$disconnect();
})();
