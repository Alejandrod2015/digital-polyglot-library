/** Que journeys (fuera de este) tienen de plaza las palabras dadas. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ws = new Set(process.argv.slice(2).map((w) => w.toLowerCase()));
  const rows = await p.journeyStory.findMany({
    select: { slug: true, vocab: true, journey: { select: { id: true, typeSlug: true, variant: true, levels: true, status: true } } },
  });
  for (const r of rows) for (const v of ((r.vocab ?? []) as any[]))
    if (ws.has(String(v.word).toLowerCase()) && r.journey.id !== "cmtpls1l20007j8epwgcs6e1h")
      console.log(`${v.word} | ${r.journey.typeSlug} ${r.journey.variant} ${(r.journey.levels || []).join(",")} ${r.journey.status} | ${r.journey.id} | ${r.slug} | ${v.type}`);
  await p.$disconnect();
})();
