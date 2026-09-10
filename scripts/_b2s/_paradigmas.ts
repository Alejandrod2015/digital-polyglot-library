/** Paradigmas (bloque f) de las claves de un fichero de capa, para leerlos uno a uno. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { readFileSync } from "fs";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
(async () => {
  const capa = JSON.parse(readFileSync(process.argv[2], "utf8")) as Record<string, Record<string, unknown>>;
  for (const [slug, m] of Object.entries(capa)) {
    const g = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } }))!.glosses as Record<string, any>;
    console.log(`## ${slug}`);
    for (const k of Object.keys(m)) {
      const e = g[k]; if (!e?.f) continue;
      const f = e.f.rows ?? e.f;
      console.log(`  ${k.padEnd(13)} ${String(e.g ?? "").slice(0, 36).padEnd(36)} | ${e.f.mood ? `[${e.f.mood}] head ${JSON.stringify(e.f.head)} ` : ""}${JSON.stringify(f).slice(0, 120)}`);
    }
  }
  await p.$disconnect();
})();
