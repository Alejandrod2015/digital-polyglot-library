/** Los trozos de contexto de las glosas que citaban frases quitadas en el
 *  arreglos de la lectura seguida de las 21 (2026-09-11). Cada trozo nuevo
 *  se comprueba contra el texto de la base antes de escribir; solo cambia `c`. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
const J = "cmtpls1l20007j8epwgcs6e1h";
type F = [string, string[], string, string];
const FIX: F[] = [
  ["el-chiste-tan-suyo", ["serio", "serios"], "Brindaron, serios", "they toasted, serious"],
  ["la-once-con-chirrido", ["vibrar", "vibraba"], "la mesa, que vibraba", "the table, which was trembling"],
  ["el-trasteo-ajeno", ["desocupado"], "la esquina, desocupado", "the corner spot, standing empty"],
  ["aca-los-errores-se-pagan", ["rebozar"], "¿Sabés rebozar", "do you know how to bread"],
  ["la-napa-del-dueno", ["plaza de mercado"], "plaza de mercado, guayaba pelada", "market stalls, peeled guava"],
  ["la-historia-sin-agrandar", ["a plena luz"], "una tarde llena, a plena luz", "on a busy afternoon, in broad daylight"],
  ["la-licitacion-desierta", ["avisaron"], "Al mes avisaron que", "a month later they announced that"],
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
  const f6 = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "aca-los-errores-se-pagan" } } });
  const errores = filas.get("aca-los-errores-se-pagan") ?? { ...(f6!.glosses as Record<string, any>) };
  filas.set("aca-los-errores-se-pagan", errores);
  if (!textos.get("aca-los-errores-se-pagan")!.includes("antes de que norma abriera")) throw new Error("abriera no esta");
  errores["abriera"] = { ...errores["abrieran"], g: "opened (subjunctive of abrir)", c: { es: "antes de que Norma abriera", en: "before Norma opened" } };
  delete errores["abrieran"]; n++;
  for (const [slug, g] of filas) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g as never } });
  console.log(`claves con trozo nuevo: ${n} en ${filas.size} historias`);
  await p.$disconnect();
})();
