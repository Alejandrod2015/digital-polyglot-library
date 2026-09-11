import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-latam-b2", slug: { not: "" } }, select: { slug: true, glosses: true } });
  const all: { slug: string; w: string; c: any }[] = [];
  for (const r of rows) for (const [w, e] of Object.entries(r.glosses as Record<string, any>)) if (e?.c) all.push({ slug: r.slug, w, c: e.c });
  const chosen: typeof all = [];
  const idx = new Set<number>();
  while (idx.size < 10) idx.add(Math.floor(Math.random() * all.length));
  for (const i of idx) chosen.push(all[i]);
  for (const c of chosen) console.log(`${c.slug} · ${c.w}: "${c.c.es}" -> "${c.c.en}"`);
  await p.$disconnect();
})();
