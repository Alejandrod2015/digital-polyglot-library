import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const A1 = "cmqfnp3tf000032afygkqp8z2";
(async () => {
  const j = await p.journey.findUnique({ where: { id: A1 }, select: { topics: true } });
  const rows = await p.journeyStory.findMany({
    where: { journeyId: A1 },
    select: { slug: true, topic: true, slotIndex: true, status: true, audioStatus: true, coverUrl: true, audioUrl: true, voiceId: true },
  });
  const orden = j?.topics ?? [];
  rows.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  console.log(JSON.stringify(rows));
  await p.$disconnect();
})();
