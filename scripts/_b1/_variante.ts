/**
 * Que pasaria si `vocab-taught-same-type` comparase dentro del POOL DE
 * VARIANTE (España va sola, `variantMatchesPreference`) en vez de dentro del
 * idioma entero. Solo lectura.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const lema = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journey: { language: "spanish", status: { not: "archived" } }, journeyId: { not: "cmt5x67ze000l320cpgunu5vi" } },
    select: { vocab: true, journey: { select: { typeSlug: true, variant: true, name: true, levels: true } } },
  });
  const hoy = new Set<string>(); const conVariante = new Set<string>(); const porJourney = new Map<string, Set<string>>();
  for (const r of rows) {
    const j = r.journey; if (!j) continue;
    const tag = `${j.name}/${j.variant}/${JSON.stringify(j.levels)}`;
    for (const v of ((r.vocab as Array<{word?:string}> ?? []))) {
      if (!v?.word) continue;
      const l = lema(String(v.word));
      if (j.typeSlug === "traveler") {
        hoy.add(l);
        if (j.variant === "spain") conVariante.add(l);
        if (!porJourney.has(tag)) porJourney.set(tag, new Set());
        porJourney.get(tag)!.add(l);
      }
    }
  }
  console.log(`cubo de tolerancia CERO hoy (todo Traveler de espanol): ${hoy.size} lemas`);
  for (const [t, s] of porJourney) console.log(`   ${t.padEnd(30)} ${s.size}`);
  console.log(`\ncubo si se compara dentro del pool de variante (Traveler spain): ${conVariante.size} lemas`);
  console.log(`devuelve ${hoy.size - conVariante.size} lemas a un B1 de España que ningun alumno de España puede ver hoy en la app.`);
})().finally(() => p.$disconnect());
