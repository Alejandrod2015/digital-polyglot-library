/** Repeticiones de una palabra dentro de una historia y por el journey. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const jid = "cmtmylg7k0007321h6t7njesx";
  const st = await prisma.journeyStory.findMany({
    where: { journeyId: jid }, select: { slug: true, topic: true, slotIndex: true, text: true, title: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  const palabra = process.argv[2];
  const re = new RegExp(`\\b${palabra}\\w*\\b`, "gi");
  for (const s of st) {
    const hits = [...String(s.text ?? "").matchAll(re)];
    if (!hits.length) continue;
    console.log(`\n${s.topic}/${s.slotIndex} ${s.slug}  (${hits.length})`);
    for (const h of hits) {
      const i = h.index ?? 0;
      console.log(`   …${String(s.text).slice(Math.max(0, i - 55), i + h[0].length + 25).replace(/\n/g, " ")}…`);
    }
  }
  await prisma.$disconnect();
})();
