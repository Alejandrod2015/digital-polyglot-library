import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const b = process.argv[2];
  const filas = await p.tapGlossSet.findMany({ where: { bundle: b, NOT: { slug: "" } } });
  let tot = 0;
  const en = new Map<string, number>();
  const m = new Map<string, Set<string>>();
  for (const f of filas) {
    for (const e of Object.values(f.glosses as Record<string, { c?: { es: string; en: string } }>)) {
      if (!e.c) continue;
      tot++;
      en.set(e.c.en, (en.get(e.c.en) ?? 0) + 1);
      if (!m.has(e.c.es)) m.set(e.c.es, new Set());
      m.get(e.c.es)!.add(e.c.en);
    }
  }
  console.log(`historias ${filas.length} | trozos ${tot}`);
  console.log("\n== INGLES REPETIDO");
  for (const [k, v] of [...en].sort((a, b2) => b2[1] - a[1]).slice(0, 14)) if (v > 2) console.log(`  ${String(v).padStart(3)}x  ${k}`);
  console.log("\n== MISMO ESPAÑOL, INGLES DISTINTO");
  const ch = [...m].filter(([, v]) => v.size > 1);
  for (const [k, v] of ch) console.log(`  "${k}" -> ` + [...v].map((x) => `"${x}"`).join(" / "));
  console.log(`  (${ch.length} en total)`);
  await p.$disconnect();
})();
