/** Pone en el bundle del B1 PT todas las historias con texto, en orden. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const J = "cmtq5n9a50007j8812p9lzxjr";
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: J, NOT: { text: null } }, select: { slug: true, topic: true, slotIndex: true } });
  rows.sort((a, b) => (j!.topics.indexOf(a.topic!) - j!.topics.indexOf(b.topic!)) || (a.slotIndex - b.slotIndex));
  const g = await p.tapGlossSet.findFirst({ where: { bundle: "portuguese-traveler-brazil-b1", slug: "" } });
  await p.tapGlossSet.update({ where: { id: g!.id }, data: { slugs: rows.map((r) => r.slug!) } });
  console.log(`bundle -> ${rows.length} historias`);
})().finally(() => p.$disconnect());
