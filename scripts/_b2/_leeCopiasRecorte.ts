/** Las 4 copias de la fila global que trajo el recorte de los temas 2-4
 *  (2026-09-11), leidas contra su frase. Dos traian otro sentido y se corrigen:
 *  "Dobló las telas" es doblar tela, no doblarse de risa; "respondió ella" es ella. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const CORRIGE: Record<string, string> = { "dobló": "folded (doblar)", "respondió": "she replied (responder)" };
const LEIDAS = ["dobló", "pelear", "pedían", "respondió"];
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
