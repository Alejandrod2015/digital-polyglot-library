/** Las 2 copias de la fila global que trajo el cambio de presentacion (2026-09-11).
 *  Las dos traian otro sentido: "Emiliano tocaba timbre" es tocar el timbre, no
 *  "le tocaba el turno"; "Ofelia manejaba el hospedaje" es llevarlo, no conducir. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const CORRIGE: Record<string, string> = { tocaba: "was ringing (tocar el timbre)", manejaba: "ran, managed (manejar)" };
const p = new PrismaClient();
(async () => {
  const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: "" } } });
  const g = { ...(fila!.glosses as Record<string, any>) };
  const noPend = Object.keys(CORRIGE).filter((k) => g[k]?.rev !== false);
  if (noPend.length) throw new Error(`no estaban pendientes: ${noPend.join(", ")}`);
  for (const [k, v] of Object.entries(CORRIGE)) g[k] = { ...g[k], g: v, rev: true };
  await p.tapGlossSet.update({ where: { id: fila!.id }, data: { glosses: g as never } });
  console.log(`leidas y corregidas ${Object.keys(CORRIGE).length}`);
  await p.$disconnect();
})();
