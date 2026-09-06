import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const r = await p.$queryRawUnsafe<Array<{ bundle: string; slug: string; glosses: Record<string, unknown> }>>(
    `SELECT "bundle","slug","glosses" FROM "dp_tap_glosses_v1" WHERE "bundle"='spanish-traveler-spain-a1' AND "slug"<>'' LIMIT 1`);
  const g = r[0].glosses as Record<string, unknown>;
  const k = Object.keys(g);
  console.log(r[0].slug, "·", k.length, "entradas");
  for (const x of k.slice(0, 5)) console.log(" ", x, JSON.stringify(g[x]));
  const conC = k.filter((x) => (g[x] as any).c); const conF = k.filter((x) => (g[x] as any).f);
  console.log(`con contexto: ${conC.length} · con formas: ${conF.length}`);
  for (const x of conF.slice(0, 2)) console.log("  FORMAS", x, JSON.stringify(g[x]));
  for (const x of conC.slice(0, 2)) console.log("  CONTEXTO", x, JSON.stringify(g[x]));
  await p.$disconnect();
})();
