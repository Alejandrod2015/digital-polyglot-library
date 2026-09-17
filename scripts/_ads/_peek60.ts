/** Solo LECTURA: la historia de "que mas pues" y su ejercicio Meaning. */
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({
    where: { title: "Aquí se dice arrendando" },
    select: { id: true, title: true, slug: true, text: true, vocab: true, audioUrl: true, coverUrl: true, journey: { select: { id: true, name: true, variant: true, status: true, typeSlug: true, levels: true } } },
  });
  console.log(JSON.stringify({ id: s?.id, journey: s?.journey, cover: s?.coverUrl, audio: !!s?.audioUrl }, null, 1));
  console.log("TEXTO:\n" + (s?.text || "").slice(0, 900));
  console.log("VOCAB:", JSON.stringify(s?.vocab));
  const sets = await p.storyPracticeSet.findFirst({ where: { storyId: s?.id }, select: { id: true, locked: true, exercises: { select: { orderIndex: true, type: true, word: true, sentence: true, payload: true, featured: true } } } });
  console.log("SETS:", JSON.stringify(sets, null, 1).slice(0, 2000));
  await p.$disconnect();
})();
