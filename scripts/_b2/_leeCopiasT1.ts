/** Las 3 glosas copiadas que trajo el recorte del tema 1 (2026-09-11), leidas
 *  contra su frase: "la libreta es mía", "secó un vaso limpio", "empujando el
 *  caballito". Las tres dicen lo que dice la frase; quedan rev:true sin cambios. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const LEIDAS = ["mía", "secó", "empujando"];
const p = new PrismaClient();
(async () => {
  const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: "" } } });
  const g = { ...(fila!.glosses as Record<string, any>) };
  const noPend = LEIDAS.filter((k) => g[k]?.rev !== false);
  if (noPend.length) throw new Error(`no estaban pendientes: ${noPend.join(", ")}`);
  for (const k of LEIDAS) g[k] = { ...g[k], rev: true };
  await p.tapGlossSet.update({ where: { id: fila!.id }, data: { glosses: g as never } });
  console.log(`leidas ${LEIDAS.length}`);
  await p.$disconnect();
})();
