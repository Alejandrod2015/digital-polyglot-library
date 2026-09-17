import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmtpls1l20007j8epwgcs6e1h" }, select: { topics: true } });
  const orden = ((j?.topics ?? []) as any[]).map((t) => (typeof t === "string" ? t : t.slug ?? t.id));
  const s = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" }, select: { slug: true, title: true, text: true, topic: true, slotIndex: true } });
  s.sort((a, b) => orden.indexOf(a.topic) - orden.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  fs.writeFileSync(process.argv[2], JSON.stringify(s));
  await p.$disconnect();
})();
