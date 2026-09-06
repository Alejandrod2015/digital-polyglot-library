import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const RE = /\b(Madrid|Barcelona|Sevilla|Valencia|Granada|M[\u00e1a]laga|Bilbao|Nerja|Frigiliana|Marbella|Alicante|C[\u00f3o]rdoba|Toledo|Salamanca|San Sebasti[\u00e1a]n|Ronda|C[\u00e1a]diz|Almer[\u00eda]a|Zaragoza|Santiago|Oviedo|Gij[\u00f3o]n|Murcia|Pamplona|Segovia|Le[\u00f3o]n|Vigo|Tarifa|Cuenca)\b/g;
(async () => {
  const js = await p.journey.findMany({ where: { language: { equals: "spanish", mode: "insensitive" }, variant: "spain", status: { not: "archived" } },
    select: { id: true, name: true, levels: true, status: true } });
  for (const j of js) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { text: true, title: true } });
    const c: Record<string, number> = {};
    for (const s of ss) for (const m of `${s.title} ${s.text}`.match(RE) ?? []) c[m] = (c[m] ?? 0) + 1;
    const ord = Object.entries(c).sort((a, b) => b[1] - a[1]);
    console.log(`${(j.levels ?? []).join(",").padEnd(4)} ${String(j.name).padEnd(16)} ${j.status.padEnd(7)} ${ss.length} historias  ${ord.map(([k, v]) => k + " " + v).join(", ")}`);
  }
  await p.$disconnect();
})();
