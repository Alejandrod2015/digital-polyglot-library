/** Las 6 copias que trajo el arreglo de presentaciones (2026-09-11), leidas
 *  contra su frase. "ponia" traia "was getting" y aqui es "keeping order". */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const CORRIGE: Record<string, string> = { "ponía": "was keeping, putting (poner); here, keeping order" };
const LEIDAS = ["e", "joven", "ponía", "invitó", "cocinero", "comprador"];
const p = new PrismaClient();
(async () => {
  const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: "" } } });
  const g = { ...(fila!.glosses as Record<string, any>) };
  const noPend = LEIDAS.filter((k) => g[k]?.rev !== false);
  if (noPend.length) throw new Error(`no estaban pendientes: ${noPend.join(", ")}`);
  for (const k of LEIDAS) g[k] = { ...g[k], ...(CORRIGE[k] ? { g: CORRIGE[k] } : {}), rev: true };
  await p.tapGlossSet.update({ where: { id: fila!.id }, data: { glosses: g as never } });
  console.log(`leidas ${LEIDAS.length} · corregidas ${Object.keys(CORRIGE).length}`);
  await p.$disconnect();
})();
