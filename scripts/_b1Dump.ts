/**
 * Vuelca las 3 historias de un tema al JSON que come saveStory.ts.
 * Existe porque el fichero de trabajo vive en /tmp y /tmp se vacia: la base
 * es la fuente buena, y reescribir un tema no puede depender de un temporal.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [journeyId, topic, out] = process.argv.slice(2);
  const ss = await p.journeyStory.findMany({
    where: { journeyId, topic },
    orderBy: { slotIndex: "asc" },
    select: { title: true, synopsis: true, text: true, vocab: true, arcType: true, topic: true, slotIndex: true },
  });
  const out_ = ss.map((s) => ({
    topic: s.topic, slotIndex: s.slotIndex, title: s.title,
    synopsis: s.synopsis, arcType: s.arcType, text: s.text, vocab: s.vocab,
  }));
  writeFileSync(out, JSON.stringify(out_, null, 1));
  console.log(`${out_.length} historias -> ${out}`);
  await p.$disconnect();
})();
