/**
 * Los slugs de `JourneyType` estaban en español (viajero, expatriado...) y el
 * resto del producto va en inglés: las etiquetas de tema, los nombres de
 * journey y el propio plan, que los llama Traveler, Expat, Cultural. El público
 * es anglosajón. Renombra los ocho y arrastra `Journey.typeSlug`.
 *
 *   npx tsx scripts/_renameJourneyTypes.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const MAPA: Record<string, string> = {
  conversacional: "conversational",
  viajero: "traveler",
  negocios: "business",
  expatriado: "expat",
  academico: "academic",
  cultural: "cultural",
  hospitalidad: "hospitality",
  salud: "health",
};

async function main() {
  const dry = process.argv.includes("--dry");
  for (const [es, en] of Object.entries(MAPA)) {
    const t = await prisma.journeyType.findUnique({ where: { slug: es }, select: { id: true, label: true } });
    if (!t) { console.log(`  ${es}: no existe (¿ya renombrado?)`); continue; }
    const journeys = await prisma.journey.count({ where: { typeSlug: es } });
    console.log(`  ${es.padEnd(15)} -> ${en.padEnd(15)} (${t.label}, ${journeys} journeys)`);
    if (dry) continue;
    await prisma.journeyType.update({ where: { id: t.id }, data: { slug: en } });
    await prisma.journey.updateMany({ where: { typeSlug: es }, data: { typeSlug: en } });
  }
  if (dry) { console.log("\n[--dry] nada escrito."); return; }
  const quedan = await prisma.journey.findMany({ where: { typeSlug: { in: Object.keys(MAPA) } }, select: { name: true } });
  console.log(`\njourneys con slug viejo: ${quedan.length}`);
}

main()
  .catch((e) => { console.error("FALLÓ:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
