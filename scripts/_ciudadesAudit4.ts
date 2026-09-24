import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const IDS = process.argv.slice(2);
(async () => {
  for (const id of IDS) {
    const st = await p.journeyStory.findMany({ where: { journeyId: id }, select: { title: true, text: true } });
    const hits: string[] = [];
    for (const s of st) {
      const blob = (s.text ?? "");
      for (const m of blob.matchAll(/\b(?:en|de|a|por|desde|hacia)\s+([A-ZÁÉÍÓÚÑ][\p{L}]{3,}(?:\s+de\s+[A-ZÁÉÍÓÚÑ][\p{L}]+)?)/gu)) hits.push(m[1]);
      for (const m of blob.matchAll(/\b(pueblo|ciudad|barrio|aldea)\b[^.]{0,60}/gu)) hits.push("~" + m[0].slice(0, 55));
    }
    const c = new Map<string, number>();
    hits.forEach(h => c.set(h, (c.get(h) ?? 0) + 1));
    console.log(`\n=== ${id}`);
    console.log([...c.entries()].sort((a,b)=>b[1]-a[1]).slice(0,22).map(([k,v])=>`${k}(${v})`).join(" | "));
  }
  await p.$disconnect();
})();
