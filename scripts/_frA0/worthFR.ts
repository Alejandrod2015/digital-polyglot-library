// SOLO LECTURA. Prueba journey-vocab-worth-teaching en frances:
//  1. este journey (Friends FR a0, 21 historias de los JSON locales);
//  2. el Expat FR a1 de la base, como control;
//  3. este journey declarado b1: sin lexico graduado, tiene que seguir SIN IMPLEMENTAR.
//   npx tsx scripts/_frA0/worthFR.ts
import "dotenv/config";
import fs from "fs";
import { PrismaClient } from "@/generated/prisma";
import { validateJourneyStories } from "@/lib/validateJourneyStories";
const p = new PrismaClient();
const worth = (nombre: string, stories: any[], level: string, journeyType: string) => {
  const jc = validateJourneyStories(stories as never, { language: "FR", level, conjuntoCompleto: true, journeyType });
  const c: any = jc.find((c: any) => c.id === "journey-vocab-worth-teaching");
  console.log(`${nombre.padEnd(34)} ${level} ${journeyType.padEnd(13)} -> ${c?.status} · ${c?.detail ?? ""}`);
};
(async () => {
  const fr = ["t1","t2","t3","t4","t5","t6","t7"].flatMap((t) => JSON.parse(fs.readFileSync(`scripts/_frA0/${t}.json`, "utf8")))
    .map((s: any) => ({ slug: s.title, title: s.title, text: s.text, vocab: s.vocab, language: "FR", level: "a0", topic: s.topic }));
  worth("Friends FR (este, 21)", fr, "a0", "relationships");
  worth("Friends FR (este, como Traveler)", fr, "a0", "traveler");
  const ex: any = await p.journey.findUnique({ where: { id: "cmt09ehi60000320qf9efrypu" }, select: { typeSlug: true, levels: true } as any });
  const est: any[] = await p.journeyStory.findMany({ where: { journeyId: "cmt09ehi60000320qf9efrypu", text: { not: null } }, select: { slug: true, title: true, text: true, vocab: true, topic: true } as any });
  const exs = est.map((s) => ({ slug: s.slug, title: s.title ?? "", text: s.text, vocab: s.vocab, language: "FR", level: ex.levels[0], topic: s.topic }));
  worth(`Expat FR (control, ${est.length})`, exs, ex.levels[0], ex.typeSlug);
  worth("Expat FR (control, como Traveler)", exs, ex.levels[0], "traveler");
  worth("Friends FR declarado b1", fr, "b1", "relationships");
  await p.$disconnect();
})();
