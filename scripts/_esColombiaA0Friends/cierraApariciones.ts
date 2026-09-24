/** Anade a `cs` los trozos escritos a mano para las apariciones que no caian
 *  en ningun trozo del generador. PURAMENTE ADITIVO: `c` no se toca, igual que
 *  cierraHuecosPorAparicion.ts, porque `c` es el campo que leen las apps ya
 *  publicadas y el que mide checkGlossContextReal. Idempotente: un trozo que
 *  ya esta en la lista no se repite. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();
const TOCABLE = /\p{L}[\p{L}\p{M}'-]*/gu;

type Trozo = { slug: string; es: string; en: string };

(async () => {
  const seco = process.argv.includes("--dry");
  const bundle = "spanish-friends-colombia-a0";
  const trozos: Trozo[] = JSON.parse(fs.readFileSync("scripts/_esColombiaA0Friends/apariciones.json", "utf8"));
  const sinTraducir = trozos.filter((t) => !t.en.trim());
  if (sinTraducir.length) {
    console.error(`PARA: ${sinTraducir.length} trozo(s) sin traducir, p. ej. ${sinTraducir[0].slug} / ${sinTraducir[0].es}`);
    process.exit(1);
  }
  const filas = await prisma.tapGlossSet.findMany({ where: { bundle }, select: { slug: true, glosses: true } });
  let tocadas = 0;
  for (const fila of filas) {
    if (!fila.slug) continue;
    const mios = trozos.filter((t) => t.slug === fila.slug);
    if (!mios.length) continue;
    const g = fila.glosses as Record<string, any>;
    let cambio = false;
    for (const t of mios) {
      for (const m of t.es.matchAll(TOCABLE)) {
        const clave = Object.keys(g).find((k) => k.toLowerCase() === m[0].toLowerCase());
        if (!clave) continue;
        const e = g[clave];
        const ya = [e.c, ...(e.cs ?? [])].filter(Boolean);
        if (ya.some((c: any) => c.es === t.es)) continue;
        e.cs = [...(e.cs ?? []), { es: t.es, en: t.en }];
        cambio = true;
        tocadas++;
      }
    }
    if (cambio && !seco) {
      await prisma.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: fila.slug } }, data: { glosses: g as never } });
    }
  }
  console.log(`${seco ? "[dry] " : ""}${tocadas} entrada(s) con trozo de aparicion anadido`);
  await prisma.$disconnect();
})();
