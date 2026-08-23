import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language: "spanish", status: { not: "archived" } } });
  const dura = new Set<string>(); const blanda = new Set<string>();
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { vocab: true } });
    const dest = j.typeSlug === "traveler" ? dura : blanda;
    let n = 0;
    for (const s of st) for (const v of ((s.vocab as any[]) ?? [])) if (v?.word) { dest.add(String(v.word)); n++; }
    console.log(`${j.typeSlug === "traveler" ? "DURA " : "blanda"} ${j.name} ${j.variant} ${JSON.stringify(j.levels)} ${j.status} -> ${n} plazas`);
  }
  const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const duraN = [...new Set([...dura].map(norm))].sort();
  const blandaN = [...new Set([...blanda].map(norm))].sort().filter((w) => !duraN.includes(w));
  console.log(`\nDURA (tolerancia 0): ${duraN.length} lemas`);
  console.log(duraN.join(" | "));
  console.log(`\nBLANDA (max 2/historia): ${blandaN.length} lemas`);
  console.log(blandaN.join(" | "));
  await p.$disconnect();
})();
