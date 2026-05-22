// Renombra títulos monotonos en JourneyStory.
//
// Identificados por el audit de skeleton: el viaje hispano "Traveler/
// latam" tenía 4 historias con patrón "[Comida] en [Lugar]" (Carnitas
// en Coyoacán, Arepas en Laureles, Mole en San Ángel, Empanadas en
// Palermo). El Traveler italiano tenía 3+ con "[Comida] a [Lugar]"
// (Arancino a Palermo, Pesto a Boccadasse, Pizza Napoletana a
// Spaccanapoli).
//
// Los nuevos títulos varían estructura: cláusulas temporales
// ("Mientras gira el trompo"), referencias internas a personajes /
// objetos ("La ricetta di Marco"), preguntas o frases evocadoras.
// Cada uno se eligió leyendo el synopsis para que match el contenido
// real, no random.
//
// SLUG y URL se preservan — sólo `title` cambia. Favorites,
// ContinueListening y UserMetric (que referencian por slug) no se ven
// afectados.

import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const RENAMES = [
  // ── Batch 1: Spanish Traveler latam (4 "en [Lugar]") ──
  { id: "cmovjexbb0001329q5e17384f", from: "Carnitas en Coyoacán", to: "Mientras gira el trompo" },
  { id: "cmoy5e2ki000132jazq2s2d2m", from: "Arepas en Laureles", to: "Antes de las dos" },
  { id: "cmownkmrd000132z52ezi2zww", from: "Mole en San Ángel", to: "Jueves con doña Luz" },
  { id: "cmoy6jujd000132kndqhbwdb3", from: "Empanadas en Palermo", to: "Una vuelta a la panadería" },
  // ── Batch 1: Italian Traveler (3 "a [Lugar]" food titles) ──
  { id: "cmogn9tbi0002l204wpc0e4dx", from: "Arancino a Palermo", to: "Il chiosco di Ballarò" },
  { id: "cmp71z04w000132j0dtgter54", from: "Pesto a Boccadasse", to: "Profumo di basilico" },
  { id: "cmomvbdkr000132cns4x546zd", from: "Pizza Napoletana a Spaccanapoli", to: "Il forno di Spaccanapoli" },
  // ── Batch 2: Italian Traveler ("al [X]" + "a Trastevere" dupes) ──
  // "Navigli al Tramonto" → habla de fiesta de quartiere; le doy
  // identidad de noche viva sin el connector "al" template.
  { id: "cmoglxwmx0003la04nz6qydo5", from: "Navigli al Tramonto", to: "Crepuscolo sui Navigli" },
  // "Trastevere al Tramonto" (c2, slug -2): vagar por las vie
  // acciottolate. Eleva la copy al nivel c2.
  { id: "cmogo94ew0001jv040vlzny18", from: "Trastevere al Tramonto", to: "L'incanto delle vie acciottolate" },
  // "Al Mercato di San Cosimato": romper el "al" prefix
  { id: "cmogmhwou0006kz04sd1s5awm", from: "Al Mercato di San Cosimato", to: "Banco di San Cosimato" },
  // "Trastevere al Tramonto" (b1, slug sin -2): Giulia + Marco,
  // cacio e pepe, jazz. Romper duplicación de título con el otro.
  { id: "cmoglxwmx0004la048md4q7t9", from: "Trastevere al Tramonto", to: "Una sera con Marco" },
  // "Arte e Luci di Sera a Trastevere": evita "a", evoca lo visual.
  { id: "cmogn9tbi0001l204gwm99b6c", from: "Arte e Luci di Sera a Trastevere", to: "Notturno tra le vie" },
  // Dos "Cacio e Pepe a Trastevere" — uno por slug, cada uno con
  // contenido distinto. Renombrar ambos para que se distingan.
  // (b1) Marco perfeccionando la ricetta
  { id: "cmoglxwmx0005la04zoiibtf1", from: "Cacio e Pepe a Trastevere", to: "La ricetta di Marco" },
  // (a1, slug -2) Giulia studentessa cercando ispirazione
  { id: "cmolrnlda000532s9ke3pqnyu", from: "Cacio e Pepe a Trastevere", to: "L'aroma del pecorino" },
];

async function main() {
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${RENAMES.length} renames\n`);

  for (const r of RENAMES) {
    const existing = await prisma.journeyStory.findUnique({
      where: { id: r.id },
      select: { id: true, title: true, slug: true },
    });
    if (!existing) {
      console.log(`  ⚠ NOT FOUND: ${r.id} (${r.from})`);
      continue;
    }
    if (existing.title !== r.from) {
      console.log(
        `  ⚠ TITLE MISMATCH: ${r.id} — expected "${r.from}", DB has "${existing.title}". Skipping.`,
      );
      continue;
    }
    console.log(`  "${r.from}" → "${r.to}"  (${existing.slug})`);
    if (APPLY) {
      await prisma.journeyStory.update({
        where: { id: r.id },
        data: { title: r.to },
      });
    }
  }

  if (!APPLY) console.log("\n[DRY RUN] Pass --apply to commit.");
  else console.log("\n→ Renames written to DB.");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
