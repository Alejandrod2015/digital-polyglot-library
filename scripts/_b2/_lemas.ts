import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "node:fs";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language: "spanish", typeSlug: "traveler", status: { in: ["active","draft"] } }, select: { id: true, variant: true, levels: true } });
  const rows: string[] = [];
  const set = new Set<string>();
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { vocab: true } });
    for (const s of st) for (const v of ((s.vocab as any[]) ?? [])) {
      const w = String(v.word ?? "").toLowerCase();
      if (w && !set.has(w)) { set.add(w); rows.push(`${w}\t${j.variant}/${j.levels}`); }
    }
  }
  fs.writeFileSync("scripts/_b2/lemas-ensenados.tsv", rows.sort().join("\n"));
  console.log("lemas unicos ya ensenados (Traveler ES):", set.size);
  await p.$disconnect();
})();
