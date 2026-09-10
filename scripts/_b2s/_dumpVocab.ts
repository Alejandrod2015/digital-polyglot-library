/** Vuelca las 21 historias del journey (slug, titulo, texto, vocab) a un JSON. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { writeFileSync } from "fs";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({ where: { journeyId: process.argv[2] }, select: { slug: true, title: true, topic: true, slotIndex: true, text: true, vocab: true } });
  const orden = ["locals-and-outsiders", "humour-and-comebacks", "rounds-and-regulars", "news-and-headlines", "wind-and-plans", "books-and-bookshops", "visits-and-old-friends"];
  rows.sort((a, b) => orden.indexOf(a.topic!) - orden.indexOf(b.topic!) || Number(a.slotIndex) - Number(b.slotIndex));
  writeFileSync(process.argv[3], JSON.stringify(rows, null, 1));
  console.log(rows.length, "historias");
  await p.$disconnect();
})();
