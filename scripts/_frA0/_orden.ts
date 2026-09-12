// SOLO LECTURA. Orden real de las historias del journey en la base: topic,
// slotIndex, slug y si ya tienen audio.
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({
    where: { journeyId: "cmtwo6cys0007j8yzg6ni3fsc" },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { topic: true, slotIndex: true, slug: true, audioUrl: true },
  });
  for (const s of st) console.log(`${s.topic.padEnd(24)} ${s.slotIndex}  ${(s.slug ?? "").padEnd(28)} ${s.audioUrl ? "AUDIO" : "-"}`);
  await p.$disconnect();
})();
