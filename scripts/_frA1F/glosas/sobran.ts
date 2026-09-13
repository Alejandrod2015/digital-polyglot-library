// SOLO LECTURA. Entradas con `c` en la base que la capa nueva no reescribe.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: "french-friends-france-a1", slug: { not: "" } } });
  for (const r of rows) {
    const nueva = JSON.parse(fs.readFileSync(`scripts/_frA1F/glosas/capas/${r.slug}.json`, "utf8"));
    for (const [k, v] of Object.entries(r.glosses as Record<string, any>)) if (v.c && !nueva[k]) console.log(`${r.slug}\t${k}\t${v.c.es} / ${v.c.en}`);
  }
  await p.$disconnect();
})();
