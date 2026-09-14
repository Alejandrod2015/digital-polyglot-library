import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { isGermanA1A2 } from "../src/lib/cefr/germanA1A2";
const p = new PrismaClient();
const strip = (w: string) => w.toLowerCase().replace(/^(der|die|das|ein|eine|sich)\s+/, "").trim();
(async () => {
  const js = await p.journey.findMany({ where: { language: "german", status: { not: "archived" } }, select: { id: true, name: true, levels: true } });
  const by = new Map<string, string[]>();
  for (const j of js) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { vocab: true } });
    for (const s of ss) for (const v of ((s.vocab as any[]) ?? [])) {
      const k = strip(String(v.word)); const tag = `${j.name}${j.levels}`;
      by.set(k, [...new Set([...(by.get(k) ?? []), tag])]);
    }
  }
  for (const w of process.argv.slice(2)) console.log(`${w.padEnd(16)} ${isGermanA1A2(w) ? "L" : "-"} ${by.get(w.toLowerCase())?.join(",") ?? "libre"}`);
  await p.$disconnect();
})();
