/** Aplica sentidos (g) y trozos (c) leidos a mano, por historia o en la fila global (""), y con --marca
 *  da por leidas (rev:true) todas las copias del bundle, que es lo que se hizo al leerlas una a una. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { readFileSync } from "fs";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
type Fix = { g?: string; c?: { es: string; en: string } };
(async () => {
  const fx = JSON.parse(readFileSync(process.argv[2], "utf8")) as Record<string, Record<string, Fix>>;
  const marca = process.argv.includes("--marca");
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let marcadas = 0;
  for (const f of filas) {
    const g = { ...(f.glosses as Record<string, any>) };
    const m = fx[f.slug] ?? {};
    for (const [k, x] of Object.entries(m)) {
      if (!g[k]) throw new Error(`${f.slug || "global"}/${k}: no existe`);
      g[k] = { ...g[k], ...(x.g ? { g: x.g } : {}), ...(x.c ? { c: x.c } : {}) };
    }
    if (marca) for (const k of Object.keys(g)) if (g[k]?.rev === false) { g[k] = { ...g[k], rev: true }; marcadas++; }
    if (Object.keys(m).length || marca) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g } });
    if (Object.keys(m).length) console.log(`${f.slug || "global"}: ${Object.keys(m).join(", ")}`);
  }
  if (marca) console.log(`${marcadas} copias marcadas como leidas`);
  await p.$disconnect();
})();
