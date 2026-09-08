import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const PALABRAS = ["al final", "tocar", "despacio", "palabra por palabra", "explicar"];
(async () => {
  const js = await p.journey.findMany({ where: { language: "spanish", status: { in: ["active", "draft"] } }, select: { id: true, name: true, variant: true, levels: true, status: true } });
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { slug: true, vocab: true, updatedAt: true } });
    for (const s of st) {
      const v = (s.vocab as any[]) ?? [];
      for (const e of v) {
        if (PALABRAS.includes(e.word)) console.log(e.word.padEnd(20), "|", j.name, j.variant, JSON.stringify(j.levels), j.status, "|", s.slug, "|", s.updatedAt.toISOString().slice(0, 10));
      }
    }
  }
  await p.$disconnect();
})();
