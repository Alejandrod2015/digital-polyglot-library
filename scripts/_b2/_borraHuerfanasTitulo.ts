/** Borra de la fila global del bundle las claves que solo vivian en titulos
 *  viejos (retitulado 2026-09-08); medidas contra titulo+cuerpo de las 21. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
const CLAVES = ["hablar","rieron","escapan","quemada","volvió","agarrarlo","apostemos","equivocado"];
(async () => {
  const p = new PrismaClient();
  const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } });
  if (!f) throw new Error("sin fila global");
  const g = { ...(f.glosses as Record<string, unknown>) };
  let n = 0;
  for (const k of CLAVES) if (k in g) { delete g[k]; n++; }
  await p.tapGlossSet.update({ where: { id: f.id }, data: { glosses: g as never } });
  console.log(`global: ${n} clave(s) borradas`);
  await p.$disconnect();
})();
