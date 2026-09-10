/** Arregla los trozos de contexto que el retitulado dejo colgando.
 *
 *  El trozo de una glosa tiene que salir TAL CUAL en la oracion donde cae, y
 *  el titulo es una oracion mas: al cambiarlo, toda glosa cuyo trozo venia del
 *  titulo viejo apunta a un texto que ya no existe. Son 95 en los dos bundles
 *  de portugues, y las tira checkGlossVariants.
 *
 *  Esto NO rehace la capa: busca solo las palabras cuyo `c.es` ya no aparece
 *  en su historia y les asigna el trozo nuevo que las contiene, con el ingles
 *  que se le pase en el diccionario de abajo. Lo que sigue cuadrando no se
 *  toca.
 *
 *  Sin --escribe solo lista lo que falta por traducir. */
import * as fs from "fs";
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { trozosDe } from "../glossContextChunks";

const p = new PrismaClient();
const BUNDLES = ["portuguese-traveler-brazil-a2", "portuguese-traveler-brazil-b1"];

/** Titulo nuevo -> ingles. El titulo entero es el trozo, porque es la oracion. */
const FICHERO_EN = "scripts/_ptTitulos/_en.json";
const EN: Record<string, string> = fs.existsSync(FICHERO_EN)
  ? JSON.parse(fs.readFileSync(FICHERO_EN, "utf8"))
  : {};

(async () => {
  const escribe = process.argv.includes("--escribe");
  const faltan = new Set<string>();
  let arregladas = 0;

  for (const bundle of BUNDLES) {
    const filas = await p.tapGlossSet.findMany({ where: { bundle }, select: { slug: true, slugs: true, glosses: true } });
    const slugs = (filas.find((f) => !f.slug)?.slugs ?? []) as string[];
    const hs = await p.journeyStory.findMany({ where: { slug: { in: slugs } }, select: { slug: true, title: true, text: true } });

    // El ingles de un trozo ya existe si otra glosa del bundle lo usa: la capa
    // COMPARTE trozo, asi que reapuntar a uno ya traducido no cuesta nada. Solo
    // hay que escribir a mano los que aparecen por primera vez.
    const yaTraducido = new Map<string, string>();
    for (const f of filas) {
      for (const v of Object.values(f.glosses as Record<string, { c?: { es?: string; en?: string } }>)) {
        if (v?.c?.es && v.c.en && !yaTraducido.has(v.c.es)) yaTraducido.set(v.c.es, v.c.en);
      }
    }

    for (const h of hs) {
      const fila = filas.find((f) => f.slug === h.slug);
      if (!fila) continue;
      const texto = `${h.title}. ${h.text}`;
      const trozos = trozosDe(texto);
      const g = fila.glosses as Record<string, { c?: { es?: string; en?: string } }>;
      let tocada = false;

      for (const [w, v] of Object.entries(g)) {
        const es = v?.c?.es;
        if (!es || texto.includes(es)) continue;           // sigue cuadrando
        const nuevo = trozos.find((t) => new RegExp(`(?<![\\p{L}\\p{M}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{M}])`, "iu").test(t));
        if (!nuevo) { console.log(`sin trozo nuevo: ${h.slug} · ${w} (tenia "${es}")`); continue; }
        const en = EN[nuevo] ?? yaTraducido.get(nuevo);
        if (!en) { faltan.add(nuevo); continue; }
        v.c = { es: nuevo, en };
        tocada = true; arregladas++;
      }
      if (tocada && escribe) {
        await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: h.slug } }, data: { glosses: g as never } });
      }
    }
  }

  if (faltan.size) {
    console.log(`\nfaltan ${faltan.size} ingleses; ponlos en PT_TITULOS_EN:`);
    for (const t of [...faltan].sort()) console.log(`  ${JSON.stringify(t)}: "",`);
  }
  console.log(`\n${arregladas} glosas reapuntadas${escribe ? " y ESCRITAS" : " (solo medido)"}`);
  await p.$disconnect();
})();
