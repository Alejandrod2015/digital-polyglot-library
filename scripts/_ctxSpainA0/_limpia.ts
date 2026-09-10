/** Borra las 19 glosas muertas del A0 de España, en los tres sitios: la fila
 *  de su historia, la fila global del bundle (solo si ya no la usa ninguna
 *  historia) y `scripts/_newGlosses.json`, que es la fuente. Antes imprime lo
 *  que dice cada una, porque "e" repetida en trece historias no parece un
 *  descuido suelto sino un patron, y el patron hay que contarlo. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";

const B = "spanish-friends-spain-a0";
const FUENTE = "scripts/_newGlosses.json";
const MUERTAS: Array<[string, string[]]> = [
  ["la-barceloneta-despierta", ["e"]],
  ["lucia-llega-a-bilbao", ["e"]],
  ["el-museo-guggenheim", ["e"]],
  ["suena-la-plaza-mayor", ["e"]],
  ["naranjas-para-dos-amigas", ["e"]],
  ["pintxos-en-el-casco-viejo", ["e"]],
  ["naranjas-en-el-mercado", ["e"]],
  ["ane-trae-mas-pintxos", ["e", "en"]],
  ["la-boqueria-huele-a-fruta", ["se"]],
  ["un-funicular-hasta-igueldo", ["a", "e"]],
  ["la-nieve-de-sierra-nevada", ["e"]],
  ["las-tapas-son-gratis", ["a", "e"]],
  ["la-giralda-desde-arriba", ["e"]],
  ["paella-en-la-malvarrosa", ["e", "en"]],
  ["lucia-mira-la-sagrada-familia", ["e"]],
];

const p = new PrismaClient();

(async () => {
  const antes = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const g0 = (antes.find((f) => !f.slug)?.glosses ?? {}) as Record<string, unknown>;
  for (const w of ["e", "en", "a", "se"]) console.log(`global "${w}": ${JSON.stringify(g0[w] ?? null)}`);

  for (const [slug, palabras] of MUERTAS) {
    const f = antes.find((x) => x.slug === slug);
    if (!f) { console.log(`sin fila: ${slug}`); continue; }
    const g = f.glosses as Record<string, unknown>;
    for (const w of palabras) delete g[w];
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g as never } });
    console.log(`${slug}: -${palabras.length}`);
  }

  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const enUso = new Set<string>();
  for (const f of filas) if (f.slug) for (const w of Object.keys(f.glosses as object)) enUso.add(w);
  const gg = (filas.find((f) => !f.slug)?.glosses ?? {}) as Record<string, unknown>;
  const candidatas = [...new Set(MUERTAS.flatMap(([, ws]) => ws))].filter((w) => !enUso.has(w) && gg[w]);
  for (const w of candidatas) delete gg[w];
  if (candidatas.length) {
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: "" } }, data: { glosses: gg as never } });
  }
  console.log(`fila global: -${candidatas.length} (${candidatas.join(", ") || "ninguna"})`);

  const fuente = JSON.parse(fs.readFileSync(FUENTE, "utf8")) as Record<string, Record<string, unknown>>;
  let nF = 0;
  for (const w of candidatas) if (fuente[B]?.[w]) { delete fuente[B][w]; nF++; }
  fs.writeFileSync(FUENTE, `${JSON.stringify(fuente, null, 2)}\n`);
  console.log(`${FUENTE}: -${nF}`);
  await p.$disconnect();
})();
