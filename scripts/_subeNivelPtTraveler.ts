// Sube un nivel los cuatro Traveler PT-BR (decidido el 2026-09-10): B1->B2, A2->B1,
// A1->A2, A0->A1. Solo metadatos de nivel (Journey.levels, JourneyStory.level) y el
// nombre de sus bundles de glosas; no toca texto, vocab ni audio.
// De arriba abajo y en UNA transaccion, para que dos journeys no compartan nivel
// ni un bundle choque con otro a medio camino.
//   npx tsx scripts/_subeNivelPtTraveler.ts          en seco
//   npx tsx scripts/_subeNivelPtTraveler.ts --apply  escribe
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const PASOS = [
  { id: "cmtq5n9a50007j8812p9lzxjr", de: "b1", a: "b2" },
  { id: "cmtrcpgso00073232h8vaf7na", de: "a2", a: "b1" },
  { id: "cmsyrge55000732u9oiu8wue3", de: "a1", a: "a2" },
  { id: "cmsou2uk0000732mqa4oatcmn", de: "a0", a: "a1" },
];
const bundle = (l: string) => `portuguese-traveler-brazil-${l}`;
async function main() {
  const apply = process.argv.includes("--apply");
  for (const s of PASOS) {
    const j = await p.journey.findUniqueOrThrow({ where: { id: s.id }, select: { levels: true, status: true } });
    const hist = await p.journeyStory.count({ where: { journeyId: s.id, level: s.de } });
    const glos = await p.tapGlossSet.count({ where: { bundle: bundle(s.de) } });
    console.log(`${s.id} ${j.status} levels=${JSON.stringify(j.levels)} -> ["${s.a}"] · historias ${s.de}: ${hist} · glosas ${bundle(s.de)}: ${glos}`);
    if (JSON.stringify(j.levels) !== JSON.stringify([s.de])) throw new Error(`estado distinto del declarado en ${s.id}`);
  }
  if (!apply) { console.log("en seco: nada escrito"); return; }
  await p.$transaction(async (tx) => {
    for (const s of PASOS) {
      await tx.journey.update({ where: { id: s.id }, data: { levels: [s.a] } });
      const h = await tx.journeyStory.updateMany({ where: { journeyId: s.id, level: s.de }, data: { level: s.a } });
      const g = await tx.tapGlossSet.updateMany({ where: { bundle: bundle(s.de) }, data: { bundle: bundle(s.a) } });
      console.log(`  ${s.de}->${s.a}: journey 1, historias ${h.count}, glosas ${g.count}`);
    }
  });
  console.log("escrito");
}
main().finally(() => p.$disconnect());
