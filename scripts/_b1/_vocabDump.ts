import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language: "spanish", status: { not: "archived" } } });
  for (const j of js as never as Array<Record<string, unknown>>) {
    const rows = await p.journeyStory.findMany({ where: { journeyId: j.id as string }, select: { vocab: true } });
    const set = new Set<string>(); let plazas = 0;
    for (const r of rows) for (const v of ((r.vocab as Array<{word?:string}> ?? []))) if (v?.word) { set.add(String(v.word)); plazas++; }
    console.log(`${String(j.id)}  ${String(j.name).padEnd(14)} ${j.language}/${j.variant} ${JSON.stringify(j.levels)} ${j.status} type=${j.typeSlug}  ${set.size} distintas / ${plazas} plazas`);
  }
})().finally(() => p.$disconnect());
