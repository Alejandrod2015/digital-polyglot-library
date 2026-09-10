// Solo lectura: vocab que ya ensenan los journeys PT (live+draft), por nivel y tipo gramatical.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const js = await p.journey.findMany({ where: { language: "portuguese", status: { not: "archived" } }, select: { id: true, levels: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: { in: js.map(j => j.id) } }, select: { journeyId: true, vocab: true } });
  const lvl = new Map(js.map(j => [j.id, j.levels[0]]));
  const out: Record<string, { levels: string[]; types: string[] }> = {};
  for (const r of rows) for (const v of (r.vocab as any[] ?? [])) {
    const w = String(v.word ?? "").toLowerCase(); if (!w) continue;
    const o = (out[w] ??= { levels: [], types: [] });
    const l = lvl.get(r.journeyId)!; if (!o.levels.includes(l)) o.levels.push(l);
    const t = String(v.type ?? ""); if (t && !o.types.includes(t)) o.types.push(t);
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  const byType: Record<string, number> = {};
  for (const o of Object.values(out)) for (const t of o.types) byType[t] = (byType[t] ?? 0) + 1;
  console.log(`${Object.keys(out).length} palabras ensenadas en PT; por tipo:`, JSON.stringify(byType));
}
main().finally(() => p.$disconnect());
