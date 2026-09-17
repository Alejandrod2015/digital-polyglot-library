/** Vocab ya ensenado en este journey, por historia, con su capa. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ss = await p.journeyStory.findMany({
    where: { journeyId: process.argv[2] },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { slug: true, vocab: true, topic: true },
  });
  const port: string[] = [], anc: string[] = [];
  for (const s of ss) {
    const v = (s.vocab ?? []) as Array<Record<string, unknown>>;
    for (const w of v) (w.anchor ? anc : port).push(String(w.word));
  }
  console.log(`PORTABLES (${port.length}):`, port.join(", "));
  console.log(`ANCLADAS (${anc.length}):`, anc.join(", "));
  await p.$disconnect();
})();
