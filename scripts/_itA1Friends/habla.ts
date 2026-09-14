// Solo lectura: gate de journey sobre los journeys italianos vigentes; vuelca estado por check a JSON.
//   npx tsx scripts/_itA1Friends/habla.ts <salida.json>
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { writeFileSync } from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { validateJourneyStories, type JourneyStoryInput } from "../../src/lib/validateJourneyStories";
const p = new PrismaClient();
const IDS = ["cmu0dpa3i0007j80ugstn0jf0", "cmss0fkc40007j8dub1zpa1kc", "cmt5wqsf7000032ghesowd0jy"];
(async () => {
  const realPeople = (await p.betaSignup.findMany({ select: { email: true } }))
    .flatMap((b) => String(b.email ?? "").split("@")[0].split(/[._\-+0-9]+/))
    .filter((w) => w.length >= 3).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  const res: Record<string, Record<string, { status: string; detail?: string }>> = {};
  for (const id of IDS) {
    const j = await p.journey.findUnique({ where: { id }, select: { topics: true, language: true, levels: true, typeSlug: true } });
    const filas = await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null } }, select: { slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true } });
    const orden = j!.topics;
    filas.sort((a, b) => orden.indexOf(a.topic) - orden.indexOf(b.topic) || a.slotIndex - b.slotIndex);
    const nivel = j!.levels[0];
    const todas: JourneyStoryInput[] = filas.map((f) => ({ slug: f.slug ?? `${f.topic}#${f.slotIndex}`, title: f.title ?? "", text: f.text!, vocab: f.vocab as never, language: j!.language, level: nivel, topic: f.topic }));
    const jc = validateJourneyStories(todas, { language: j!.language, level: nivel, realPeople, journeyId: id, journeyType: j!.typeSlug });
    res[`${id} ${j!.typeSlug} ${nivel} (${todas.length})`] = Object.fromEntries(jc.map((c) => [c.id, { status: c.status, detail: c.detail }]));
  }
  writeFileSync(process.argv[2], JSON.stringify(res, null, 1));
  await p.$disconnect();
})();
