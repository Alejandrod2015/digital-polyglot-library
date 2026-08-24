import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const key = (v: { word: string }) => v.word.toLowerCase().trim();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmt70xfyt000l3283gxd70wck" }, select: { status: true, nextJourneyId: true } });
  console.log("A2:", j?.status, "-> ", j?.nextJourneyId);
  const get = async (id: string) => {
    const rows = await p.journeyStory.findMany({ where: { journeyId: id }, select: { slug: true, vocab: true } });
    return rows.flatMap((r) => ((r.vocab as Array<{word:string}>) ?? []).map((v) => [key(v), r.slug] as const));
  };
  const a2 = new Map((await get("cmt70xfyt000l3283gxd70wck")).map(([w, s]) => [w, s]));
  const b1 = await get("cmt5x67ze000l320cpgunu5vi");
  const choque = b1.filter(([w]) => a2.has(w));
  console.log("plazas A2:", a2.size, "| plazas B1:", b1.length);
  console.log("CHOQUES:", choque.length);
  for (const [w, s] of choque) console.log("  ", w.padEnd(18), "B1:", s.padEnd(30), "A2:", a2.get(w));
  await p.$disconnect();
})();
