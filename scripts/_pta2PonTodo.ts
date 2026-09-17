/** Aplica la capa de contexto de las 21 historias de una vez, leyendo
 *  scripts/_pta2ctx/<slug>.json. Falla sin escribir nada si a alguna le
 *  falta un trozo por traducir. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { trozosDe } from "./_pta2Trozos";

const B = "portuguese-traveler-brazil-a2";
const TOCABLE = /\p{L}[\p{L}\p{M}'-]*/gu;
const DIR = "scripts/_pta2ctx";
const p = new PrismaClient();

(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, slugs: true, glosses: true } });
  const global = (filas.find((f) => !f.slug)?.glosses ?? {}) as Record<string, Record<string, unknown>>;
  const slugs = (filas.find((f) => !f.slug)?.slugs ?? []) as string[];
  const historias = await p.journeyStory.findMany({
    where: { slug: { in: slugs } }, select: { slug: true, title: true, text: true },
  });

  const plan: Array<{ slug: string; salida: Record<string, Record<string, unknown>>; n: number }> = [];
  const problemas: string[] = [];

  for (const h of historias) {
    const fichero = `${DIR}/${h.slug}.json`;
    if (!fs.existsSync(fichero)) { problemas.push(`${h.slug}: sin fichero`); continue; }
    const EN = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, string>;
    const previa = (filas.find((f) => f.slug === h.slug)?.glosses ?? {}) as Record<string, Record<string, unknown>>;
    // Se parte BORRANDO los trozos viejos. Sin esto, un trozo que dejo de
    // existir al apretar el troceador se queda pegado en las palabras que ya
    // no cubre, y el lint lo sigue viendo. Los que se escriben palabra a
    // palabra (_pta2Huecos) se vuelven a poner despues.
    const salida: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of Object.entries(previa)) {
      const { c: _viejo, ...resto } = v as Record<string, unknown>;
      salida[k] = resto;
    }
    const vistas = new Set<string>();
    let n = 0;
    for (const t of trozosDe(`${h.title}. ${h.text}`)) {
      const dentro = [...new Set((t.toLowerCase().match(TOCABLE) ?? []))]
        .filter((w) => global[w] && !vistas.has(w));
      if (!dentro.length) continue;
      if (!EN[t]) { problemas.push(`${h.slug}: sin traducir "${t}"`); continue; }
      for (const w of dentro) {
        vistas.add(w);
        salida[w] = { ...(global[w] ?? {}), ...(salida[w] ?? {}), c: { es: t, en: EN[t] } };
        n++;
      }
    }
    plan.push({ slug: h.slug!, salida, n });
  }

  if (problemas.length) {
    console.error(`NADA ESCRITO. ${problemas.length} problema(s):`);
    for (const x of problemas.slice(0, 20)) console.error("   " + x);
    process.exit(1);
  }
  for (const { slug, salida } of plan)
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: salida as never } });
  console.log(`${plan.length} historias · ${plan.reduce((a, b) => a + b.n, 0)} palabras con su trozo`);
  await p.$disconnect();
})();
