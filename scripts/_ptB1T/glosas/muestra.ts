// SOLO LECTURA. N entradas `c` al azar de la capa, leidas de la base.
//   npx tsx scripts/_ptB1T/glosas/muestra.ts [n]
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: "portuguese-traveler-brazil-b1", slug: { not: "" } } });
  const all = rows.flatMap((r) => Object.entries(r.glosses as Record<string, any>).filter(([, v]) => v.c).map(([k, v]) => `${r.slug} | ${k} | g: ${v.g} | ${v.c.es} / ${v.c.en}`));
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  console.log(all.slice(0, Number(process.argv[2] ?? 15)).join("\n"));
  await p.$disconnect();
})();
