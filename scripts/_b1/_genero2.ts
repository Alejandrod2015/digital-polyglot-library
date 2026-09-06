/** Los que no llevan articulo delante en el texto ("en enero", "por horas",
 *  "de golpe") van a mano. Los nombres propios se quedan sin marca. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const G: Record<string, string> = {
  mes: "m.", dato: "m.", enero: "m.", falta: "f.", horas: "f.", pisos: "m.", prueba: "f.", ascensor: "m.",
  obra: "f.", tapa: "f.", cinta: "f.", golpe: "m.", ruido: "m.", normas: "f.", trozos: "m.", momento: "m.",
  perchas: "f.", permiso: "m.", voz: "f.", agua: "f.", cola: "f.", voto: "m.", abril: "m.", "días": "m.",
  parte: "f.", prisa: "f.", cuenta: "f.", "plástico": "m.",
};
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-spain-b1", NOT: { slug: "" } } });
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    let n = 0;
    for (const [w, m] of Object.entries(G)) if (g[w] && g[w].t === "noun" && !g[w].gm) { g[w].gm = m; n++; }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: f.bundle, slug: f.slug } }, data: { glosses: g } });
    console.log(`${f.slug.padEnd(28)} +${n}`);
  }
  await p.$disconnect();
})();
