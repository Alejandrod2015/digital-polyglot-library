/**
 * Asigna el `typeSlug` de cada journey.
 *
 * POR QUÉ (2026-08-18). El tipo decide cuántos personajes fijos lleva un
 * journey, si el orden de temas es obligado y qué son los siete temas, pero no
 * se guardaba: se adivinaba por el nombre. Y el plan dice que el nombre nunca
 * es el tipo, porque el nombre es la promesa al comprador. "Hanseat" es un
 * Expat y "Village Life in Andalusia" no se deja adivinar.
 *
 * El mapa es EXPLÍCITO por journey, no una heurística sobre el nombre: heredar
 * el error de adivinar sería justo lo que esto viene a arreglar.
 *
 *   npx tsx scripts/_setJourneyTypes.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

/** name|language/variant -> slug de JourneyType. */
const MAPA: Record<string, string> = {
  "Expat|german/germany": "expat",
  "Hanseat|german/germany": "expat",   // Expat de Hamburgo; el nombre no lo dice
  "Traveler|german/germany": "traveler",
  "Friends|german/germany": "conversational",
  "Traveler|italian/italy": "traveler",
  "Friends|italian/italy": "conversational",
  "Traveler|portuguese/brazil": "traveler",
  "Friends|spanish/argentina": "conversational",
  "Friends|spanish/colombia": "conversational",
  "Traveler|spanish/latam": "traveler",
  "Friends|spanish/latam": "conversational",
  "Friends|spanish/mexico": "conversational",
  "Traveler|spanish/mexico": "traveler",
  "Friends|spanish/spain": "conversational",
  "Village Life in Andalusia|spanish/spain": "traveler", // pueblo andaluz recorrido, sin instalarse
};

async function main() {
  const dry = process.argv.includes("--dry");
  const tipos = new Set((await prisma.journeyType.findMany({ select: { slug: true } })).map((t) => t.slug));
  const js = await prisma.journey.findMany({
    where: { status: { not: "archived" } },
    select: { id: true, name: true, language: true, variant: true, typeSlug: true },
  });

  let puestos = 0;
  const sinMapa: string[] = [];
  for (const j of js) {
    const clave = `${j.name}|${j.language}/${j.variant}`;
    const slug = MAPA[clave];
    if (!slug) { sinMapa.push(clave); continue; }
    if (!tipos.has(slug)) { console.log(`  tipo inexistente "${slug}" para ${clave}`); continue; }
    if (j.typeSlug === slug) continue;
    console.log(`  ${clave.padEnd(42)} -> ${slug}`);
    if (!dry) await prisma.journey.update({ where: { id: j.id }, data: { typeSlug: slug } });
    puestos++;
  }
  console.log(`\n${puestos} journey(s) ${dry ? "a marcar" : "marcados"} · ${js.length} vivos`);
  if (sinMapa.length) console.log(`SIN TIPO EN EL MAPA (${sinMapa.length}): ${sinMapa.join(" · ")}`);
}

main()
  .catch((e) => { console.error("FALLÓ:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
