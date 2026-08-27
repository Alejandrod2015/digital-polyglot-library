/** Devuelve los bloques `f` (conjugación, plural, paradigma de pronombre) tal
 *  como estaban en `src/data/tapGlosses/<bundle>.json` antes de la mudanza a la
 *  base, SIN tocar los trozos `c` ni el género `gm`, que son posteriores y no
 *  estan en git.
 *
 *  npx tsx scripts/_restoreF.ts <bundle> <json-de-git> [--dry]
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const [bundle, fichero] = process.argv.slice(2);
  const dry = process.argv.includes("--dry");
  const viejo = JSON.parse(fs.readFileSync(fichero, "utf8")) as { byStory?: Record<string, Record<string, any>> };
  const filas = await p.tapGlossSet.findMany({ where: { bundle } });
  let puestas = 0, iguales = 0, sinViejo = 0;
  for (const f of filas.filter((x) => x.slug !== "")) {
    const capa = f.glosses as Record<string, any>;
    const antes = viejo.byStory?.[f.slug] ?? {};
    let toco = false;
    for (const [w, e] of Object.entries(capa)) {
      const vf = antes[w]?.f;
      if (!vf) { if (!e.f) sinViejo++; continue; }
      if (JSON.stringify(e.f ?? null) === JSON.stringify(vf)) { iguales++; continue; }
      e.f = vf; puestas++; toco = true;
    }
    if (toco && !dry) await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: f.slug } }, data: { glosses: capa as never } });
  }
  console.log(`${bundle}: ${puestas} bloques devueltos, ${iguales} ya iguales${dry ? " (--dry)" : ""}`);
  await p.$disconnect();
}
main();
