/** Enseña una clave de glosa de spanish-friends con su definicion BASE y con
 *  TODAS las frases del bundle donde se usa. La definicion tiene que cubrir el
 *  uso real de sus historias: si la g dice un sentido y la historia usa otro,
 *  la tarjeta se contradice sola.
 *
 *  Uso: _jerga.ts <palabra> [palabra...]   (sin argumentos, lista candidatas) */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const B = "spanish-friends";
const p = new PrismaClient();

(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, slugs: true, glosses: true } });
  const globalFila = filas.find((f) => !f.slug);
  const global = (globalFila?.glosses ?? {}) as Record<string, { g?: string; t?: string; rev?: boolean }>;
  const slugs = (globalFila?.slugs ?? []) as string[];
  const hs = await p.journeyStory.findMany({ where: { slug: { in: slugs } }, select: { slug: true, title: true, text: true } });

  const palabras = process.argv.slice(2);
  if (!palabras.length) {
    console.log(`${Object.keys(global).length} claves en la fila global de ${B}`);
    process.exit(0);
  }

  for (const w of palabras) {
    console.log(`\n══ ${w}`);
    console.log(`  global: ${JSON.stringify(global[w] ?? null)}`);
    const re = new RegExp(`(?<![\\p{L}\\p{M}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{M}])`, "giu");
    for (const h of hs) {
      const texto = `${h.title}. ${h.text}`;
      for (const frase of texto.split(/(?<=[.!?…][”"]?)\s+|\n+/)) {
        if (!new RegExp(re.source, "iu").test(frase)) continue;
        console.log(`  · ${h.slug}: ${frase.trim()}`);
      }
    }
    const propias = filas.filter((f) => f.slug && (f.glosses as Record<string, unknown>)[w]).map((f) => f.slug);
    console.log(`  filas de historia: ${propias.join(", ") || "ninguna"}`);
  }
  await p.$disconnect();
})();
