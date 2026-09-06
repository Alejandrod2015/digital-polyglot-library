/** Reescribe trozos de contexto que no salian tal cual del texto. Cada uno es
 *  ahora un constituyente literal de su oracion, y su ingles traduce ESE
 *  trozo. Se carga por historia; el que no se nombra, no se toca. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "node:fs";
const N = (t: string) => t.normalize("NFC").toLowerCase().replace(/[“”"«»().,;:¡!¿?]/g, "").replace(/\s+/g, " ").trim();
(async () => {
  const p = new PrismaClient();
  const B = "spanish-traveler-spain-b1";
  const arreglos: Record<string, Record<string, { es: string; en: string }>> =
    JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const ss = await p.journeyStory.findMany({ where: { slug: { in: Object.keys(arreglos) } }, select: { slug: true, title: true, text: true } });
  const texto = new Map(ss.map((s) => [s.slug!, `${s.title}. ${s.text}`]));
  let n = 0, mal = 0;
  for (const [slug, mapa] of Object.entries(arreglos)) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    if (!fila) { console.log(`  sin capa: ${slug}`); continue; }
    const g = fila.glosses as Record<string, any>;
    const oraciones = (texto.get(slug) ?? "").split(/(?<=[.?!”])\s+/).map(N);
    for (const [w, c] of Object.entries(mapa)) {
      if (!g[w]) { console.log(`  no existe ${slug}·${w}`); mal++; continue; }
      if (!oraciones.some((o) => o.includes(N(c.es)))) { console.log(`  NO SALE ${slug}·${w}: "${c.es}"`); mal++; continue; }
      g[w] = { ...g[w], c: { es: c.es, en: c.en } };
      n++;
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
  }
  console.log(`trozos reescritos ${n}${mal ? ` · rechazados ${mal}` : ""}`);
  await p.$disconnect();
})();
