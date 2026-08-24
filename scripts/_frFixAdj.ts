/** Dos plazas de vocabulario en forma femenina que el titular de la práctica
 *  muestra tal cual, contra la regla de forma de diccionario. Se pasan a la
 *  EXPRESIÓN que la historia usa de verdad, que además evita chocar con `seul`
 *  y `bas`, ya enseñados en otras historias del journey. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const ID = "cmt09ehi60000320qf9efrypu";
const CAMBIOS: Record<string, Record<string, any>> = {
  "camille-attend-depuis-vingt-minutes": {
    "basse": { word: "à voix basse", type: "expression", surface: "à voix basse", definition: "in a quiet, low voice" },
  },
  "nicolas-part-en-juin": {
    "seule": { word: "tout seul", type: "expression", surface: "toute seule", definition: "on your own, with nobody helping" },
  },
};
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: ID, slug: { in: Object.keys(CAMBIOS) } },
    select: { topic: true, slotIndex: true, title: true, slug: true, synopsis: true, text: true, vocab: true, arcType: true },
  });
  const payload = rows.map((r) => {
    const mapa = CAMBIOS[r.slug!];
    const vocab = ((r.vocab as any[]) ?? []).map((v) => (mapa[String(v.word)] ? { ...v, ...mapa[String(v.word)] } : v));
    const faltan = Object.keys(mapa).filter((k) => !((r.vocab as any[]) ?? []).some((v) => String(v.word) === k));
    if (faltan.length) throw new Error(`${r.slug}: no encontré ${faltan.join(", ")}`);
    return { ...r, vocab };
  });
  fs.writeFileSync(process.argv[2], JSON.stringify(payload, null, 2));
  console.log(`${payload.length} historias -> ${process.argv[2]}`);
  await p.$disconnect();
})();
