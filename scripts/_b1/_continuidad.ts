import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({
    where: { id: { in: ["cmrr5hnbl000032k1esry5n8g","cmsvz6mz9000732gsgsfer0ko","cmt70xfyt000l3283gxd70wck","cmt5x67ze000l320cpgunu5vi"] } },
    select: { id: true, typeSlug: true, levels: true, nextJourneyId: true, status: true, _count: { select: { stories: true } } },
  });
  for (const j of js) console.log((j.typeSlug ?? "?").padEnd(12), (j.levels ?? []).join(","), String(j.status).padEnd(7), String(j._count.stories).padStart(2), "->", j.nextJourneyId ?? "(vacio)");
  const b1 = await p.journeyStory.findMany({ where: { journeyId: "cmt5x67ze000l320cpgunu5vi" }, select: { slug: true, text: true, title: true } });
  console.log("\nen las 21 del B1:");
  for (const re of [/\bálvaro\b/i, /\bsemilla/i, /\bhuerto\b/i, /\bllaves?\b/i, /hermano de Roc/i]) {
    const hits = b1.filter((s) => re.test(`${s.title} ${s.text}`));
    console.log("  ", String(re).padEnd(22), `${hits.length}/21`, hits.map((h) => h.slug).slice(0,3).join(", "));
  }
  await p.$disconnect();
})();
