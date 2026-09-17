/** Prepara el data.json de "El gallo colorado" con la definicion de "dar fiado"
 *  mas corta. Solo LEE la base; el guardado lo hace saveStory.ts. */
import { PrismaClient } from "../../src/generated/prisma";
import { writeFileSync } from "node:fs";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({
    where: { title: "El gallo colorado" },
    select: { topic: true, slotIndex: true, title: true, slug: true, synopsis: true, text: true, vocab: true, arcType: true, level: true, journeyId: true, journey: { select: { variant: true, language: true } } },
  });
  const vocab = (s!.vocab as unknown as Array<{ word: string; definition: string }>).map((v) =>
    v.word === "dar fiado" ? { ...v, definition: "To take it now and pay later, on trust." } : v);
  const out = [{ topic: s!.topic, slotIndex: s!.slotIndex, title: s!.title, slug: s!.slug, synopsis: s!.synopsis, text: s!.text, vocab, arcType: s!.arcType }];
  writeFileSync("scripts/_ads/_fiado.json", JSON.stringify(out, null, 1));
  console.log("journey", s!.journeyId, "| level", s!.level, "| variant", s!.journey?.variant, "| topic", s!.topic, "slot", s!.slotIndex);
  await p.$disconnect();
})();
