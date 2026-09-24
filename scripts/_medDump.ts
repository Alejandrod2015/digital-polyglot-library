/** Vuelca las historias de un journey al formato que come saveStory.ts, en orden de Journey.topics. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const id = process.argv[2];
  const j = await p.journey.findUnique({ where: { id }, select: { topics: true, language: true, levels: true, variant: true,
    stories: { select: { slug: true, title: true, text: true, topic: true, slotIndex: true, synopsis: true, vocab: true, arcType: true } } } });
  if (!j) { console.error("no journey"); process.exit(2); }
  const orden = (t: string | null) => { const i = j.topics.indexOf(t ?? ""); return i < 0 ? 99 : i; };
  const filas = j.stories.filter(s => (s.text ?? "").length > 200)
    .sort((a, b) => (orden(a.topic) - orden(b.topic)) || (a.slotIndex - b.slotIndex));
  const data = filas.map(f => ({ topic: f.topic, slotIndex: f.slotIndex, title: f.title, slug: f.slug,
    synopsis: f.synopsis, text: f.text, vocab: f.vocab, arcType: f.arcType }));
  fs.writeFileSync(process.argv[3], JSON.stringify(data, null, 1));
  console.log(JSON.stringify({ n: data.length, lang: j.language, level: (j.levels ?? [])[0], variant: j.variant }));
})().finally(() => p.$disconnect());
