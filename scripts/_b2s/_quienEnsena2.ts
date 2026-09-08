import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const PALABRAS = ["buzón"];
(async () => {
  const js = await p.journey.findMany({ where: { language: "spanish", status: { in: ["active", "draft"] } }, select: { id: true, name: true, variant: true, levels: true } });
  let hits = 0;
  for (const j of js) for (const s of await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { slug: true, vocab: true } }))
    for (const e of ((s.vocab as any[]) ?? [])) if (PALABRAS.includes(e.word)) { hits++; console.log(e.word, "|", j.name, j.variant, JSON.stringify(j.levels), "|", s.slug, "| type", e.type); }
  console.log(hits ? `${hits} choques` : "las 5 libres en todo el catalogo ES");
  await p.$disconnect();
})();
