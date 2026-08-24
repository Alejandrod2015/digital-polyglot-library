/** Qué proporción de las réplicas lleva al narrador cerca: o acotación en el
 *  mismo párrafo, o una línea de narración justo antes. */
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const CITA = /“([^”]+)”/g;
const pal = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
(async () => {
  const js = await p.journey.findMany({ where: { status: { in: ["active", "draft"] } }, select: { id: true, name: true, language: true, variant: true, levels: true, status: true } });
  const filas: string[] = [];
  for (const j of js) {
    const rows = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { text: true } });
    if (rows.length < 7) continue;
    let citados = 0, conNarrador = 0;
    for (const s of rows) {
      const ps = (s.text ?? "").split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
      ps.forEach((x, i) => {
        if (!CITA.test(x)) return;
        CITA.lastIndex = 0;
        citados++;
        const propia = pal(x.replace(CITA, " ")) >= 2;
        const previa = i > 0 && !/“/.test(ps[i - 1]);
        if (propia || previa) conNarrador++;
      });
    }
    if (!citados) continue;
    filas.push(`${(j.name + " " + j.language + "/" + j.variant + " " + (j.levels ?? []).join("")).padEnd(40)} ${j.status.padEnd(6)} ${citados} parrafos citados · con narrador al lado ${Math.round((conNarrador / citados) * 100)}%`);
  }
  console.log(filas.sort().join("\n"));
  await p.$disconnect();
})();
