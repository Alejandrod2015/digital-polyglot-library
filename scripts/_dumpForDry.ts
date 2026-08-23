import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
(async () => {
  const J = "cmt0a8vb1000m32p1x7r5ba28";
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const orden: string[] = (j?.topics as string[]) ?? [];
  const ss = await p.journeyStory.findMany({ where: { journeyId: J },
    select: { topic: true, slotIndex: true, title: true, slug: true, synopsis: true, text: true, vocab: true, arcType: true } });
  ss.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  fs.writeFileSync(process.argv[2], JSON.stringify(ss, null, 2));
  console.log("escritas", ss.length);
  await p.$disconnect();
})();
