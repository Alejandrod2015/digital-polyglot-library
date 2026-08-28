/** Corrige el tipo (y opcionalmente la glosa) de una palabra en la capa de UNA
 *  historia. npx tsx scripts/_setTipo.ts <bundle> <slug> <palabra> <tipo> [glosa] */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [bundle, slug, w, tipo, glosa] = process.argv.slice(2);
  const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug } } });
  const g = f!.glosses as Record<string, { g: string; t: string; gm?: string }>;
  if (!g[w]) { console.error(`${w} no está en ${slug}`); process.exit(1); }
  console.log(`${slug} · ${w}: ${g[w].t} -> ${tipo}${glosa ? ` · "${g[w].g}" -> "${glosa}"` : ""}`);
  g[w].t = tipo;
  if (glosa) g[w].g = glosa;
  delete g[w].gm;
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug } }, data: { glosses: g as never } });
  await p.$disconnect();
})();
