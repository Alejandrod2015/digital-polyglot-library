/** Correcciones de la lectura de paradigmas, en la fila de la historia: g, t, quitar f, o filas de un bloque de modo. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { readFileSync } from "fs";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
type Fix = { g?: string; t?: string; sinF?: boolean; rows?: string[] };
const P = ["yo", "tú", "él, ella", "nosotros", "vosotros", "ellos"];
(async () => {
  const fx = JSON.parse(readFileSync(process.argv[2], "utf8")) as Record<string, Record<string, Fix>>;
  const glob = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!.glosses as Record<string, any>;
  for (const [slug, m] of Object.entries(fx)) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...(fila!.glosses as Record<string, any>) };
    for (const [k, f] of Object.entries(m)) {
      const e = { ...(glob[k] ?? {}), ...(g[k] ?? {}) };
      if (!e.c) throw new Error(`${slug}/${k}: sin trozo`);
      if (f.g) e.g = f.g;
      if (f.t) e.t = f.t;
      if (f.sinF) delete e.f;
      if (f.rows) { if (!e.f?.mood) throw new Error(`${slug}/${k}: no es bloque de modo`); e.f = { ...e.f, rows: P.map((per, i) => [per, f.rows![i]]) }; }
      g[k] = e;
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
    console.log(`${slug}: ${Object.keys(m).join(", ")}`);
  }
  await p.$disconnect();
})();
