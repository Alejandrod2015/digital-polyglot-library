import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ss = await p.journeyStory.findMany({ where: { journeyId: "cmt5x67ze000l320cpgunu5vi" },
    select: { slug: true, status: true, topic: true, slotIndex: true } });
  for (const s of ss) console.log(" ", s.slug, "|", s.status, "|", s.topic, s.slotIndex);
  const j = await p.journey.findUnique({ where: { id: "cmt5x67ze000l320cpgunu5vi" }, select: { status: true, topics: true } });
  console.log("journey:", j?.status, j?.topics.join(","));
  await p.$disconnect();
})();
