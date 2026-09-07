/**
 * Borra de las filas por historia las glosas cuya palabra ya NO sale en el
 * texto de esa historia.
 *
 * Aparecen al editar una historia despues de escribir su capa: la palabra
 * desaparece del cuerpo y su trozo se queda apuntando a una frase que ya no
 * existe. checkGlossContext no las ve (la palabra no esta en el texto) y
 * checkGlossVariants si, que es como salio "embaixo" al mover el remate de la
 * historia del frasco.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const B = "portuguese-traveler-brazil-a2";
const TOCABLE = /\p{L}[\p{L}\p{M}'-]*/gu;
const p = new PrismaClient();

(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  let n = 0;
  for (const f of filas) {
    if (!f.slug) continue;
    const h = await p.journeyStory.findFirst({ where: { slug: f.slug }, select: { title: true, text: true } });
    if (!h) continue;
    const enTexto = new Set([...`${h.title}. ${h.text}`.toLowerCase().matchAll(TOCABLE)].map((m) => m[0]));
    const g = f.glosses as Record<string, unknown>;
    const fuera = Object.keys(g).filter((w) => !enTexto.has(w));
    if (!fuera.length) continue;
    for (const w of fuera) delete g[w];
    n += fuera.length;
    console.log(`${f.slug}: ${fuera.join(", ")}`);
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g as never } });
  }
  console.log(`huerfanas borradas: ${n}`);
  await p.$disconnect();
})();
