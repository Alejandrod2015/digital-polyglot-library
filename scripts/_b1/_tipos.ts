import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language: { equals: "spanish", mode: "insensitive" }, variant: "spain", status: { not: "archived" } },
    select: { id: true, typeSlug: true, levels: true } });
  for (const j of js) {
    const rows = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { vocab: true } });
    const c: Record<string, number> = {}; let n = 0;
    for (const r of rows) for (const v of ((r.vocab as Array<{ type?: string }>) ?? [])) { const t = v.type ?? "?"; c[t] = (c[t] ?? 0) + 1; n++; }
    const pct = Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v / n * 100)}%`).join(" · ");
    console.log(`${j.typeSlug}/${(j.levels ?? []).join("")}`.padEnd(16), `${rows.length} hist · ${n} plazas ·`, pct);
  }
  await p.$disconnect();
})();
