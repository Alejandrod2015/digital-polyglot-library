/** Los trozos de contexto de las glosas que citaban frases quitadas en el
 *  arreglo de presentaciones, ronda 2 (2026-09-11). Cada trozo nuevo
 *  se comprueba contra el texto de la base antes de escribir; solo cambia `c`. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
const J = "cmtpls1l20007j8epwgcs6e1h";
type F = [string, string[], string, string];
const FIX: F[] = [
  ["la-cortesia-mas-cara", ["chifa"], "invitó a Aurelio a un chifa", "invited Aurelio to a chifa"],
  ["la-cortesia-mas-cara", ["costura"], "con taller de costura", "with a dressmaking shop"],
  ["la-cortesia-mas-cara", ["almorzar", "almorzando"], "cerraba los tratos más grandes almorzando", "closed her biggest deals over lunch"],
  ["la-cortesia-mas-cara", ["muestrario"], "invitó a Aurelio a un chifa, muestrario en mano", "invited Aurelio to a chifa, sample book in hand"],
  ["de-medio-metro-y-gracias", ["cuentero"], "el cuentero de Aracataca", "the storyteller from Aracataca"],
  ["de-medio-metro-y-gracias", ["mecedora"], "Baldomero, el cuentero de Aracataca, Colombia, en la mecedora", "Baldomero, the storyteller from Aracataca, Colombia, in the rocking chair"],
  ["de-medio-metro-y-gracias", ["hospedaje"], "Ofelia era la dueña del hospedaje", "Ofelia was the owner of the guesthouse"],
];
(async () => {
  const p = new PrismaClient();
  const textos = new Map((await p.journeyStory.findMany({ where: { journeyId: J }, select: { slug: true, text: true } })).map((s) => [s.slug, s.text.toLowerCase()]));
  const filas = new Map<string, Record<string, any>>();
  let n = 0;
  for (const [slug, claves, es, en] of FIX) {
    if (!textos.get(slug)?.includes(es.toLowerCase())) throw new Error(`${slug}: el trozo no esta en el texto: ${es}`);
    if (!filas.has(slug)) {
      const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
      filas.set(slug, { ...(f!.glosses as Record<string, any>) });
    }
    const g = filas.get(slug)!;
    for (const k of claves) { if (!g[k]) throw new Error(`${slug}: sin clave ${k}`); g[k] = { ...g[k], c: { es, en } }; n++; }
  }
  for (const [slug, g] of filas) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g as never } });
  console.log(`claves con trozo nuevo: ${n} en ${filas.size} historias`);
  await p.$disconnect();
})();
