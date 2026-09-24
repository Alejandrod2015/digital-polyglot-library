/**
 * Crea el journey Friends DE/germany B1 en DRAFT, enmarcado en MUNICH: las 7
 * filas de `Topic`, la fila de `Journey`, y los 21 slots vacios de
 * `JourneyStory`. Calcado de `_createB2Spain.ts`.
 *
 * Por que existe: la escalera del Friends aleman iba A0 (Bremen), A1
 * (Frankfurt), A2 (Hannover), HUECO, y el C1 esta fuera de escalera. Sin el B1
 * no se puede abrir un B2 aleman y quien mide B1 cae en el A2 o en el C1.
 *
 * Por que Munich: las tres ciudades alemanas que ya estaban aprobadas estan
 * ocupadas (Berlin = Expat C1, Hamburg = Expat C1 draft, Frankfurt = Friends
 * A1), y dentro del Friends aleman tambien Bremen y Hannover. El usuario
 * aprobo Munich el 2026-09-24 (commit ee8fed04).
 *
 * Los siete temas se eligieron con Munich delante: cinco de ellos no se
 * sostienen en otra ciudad alemana (Biergarten con comida propia, la Wiesn, la
 * Weisswurst antes del mediodia, la ola del Eisbach y los bancos de grava del
 * Isar, los Alpes a una hora en S-Bahn). Los otros dos llevan lexico local: el
 * domingo barato de las Pinakotheken y el Deutsches Museum, y la cola de
 * Besichtigung del mercado de alquiler mas caro del pais.
 *
 *   npx tsx scripts/_createDeB1Friends.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded, type TopicProposal } from "../src/lib/topicEvidence";
import { assertLadderContiguous } from "../src/lib/journeyLadder";

const p = new PrismaClient();
const DRY = process.argv.includes("--dry");

const CITY = "Munich";

/** Los siete, en orden de lectura. */
const TEMAS: Array<TopicProposal & { slug: string }> = [
  { label: "Beer Gardens & Regulars", slug: "beer-gardens-and-regulars" },
  { label: "Oktoberfest & Reserved Tables", slug: "oktoberfest-and-reserved-tables" },
  { label: "Weisswurst & Late Risers", slug: "weisswurst-and-late-risers" },
  { label: "Rivers & Summer Heat", slug: "rivers-and-summer-heat" },
  { label: "Alps & Day Trips", slug: "alps-and-day-trips" },
  { label: "Museums & Cheap Sundays", slug: "museums-and-cheap-sundays" },
  { label: "Rents & Waiting Lists", slug: "rents-and-waiting-lists" },
];

(async () => {
  const todos = await p.journey.findMany({
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true, topics: true },
  });

  assertLadderContiguous(
    { name: "Friends", language: "german", variant: "germany", levels: ["b1"] },
    todos as any,
  );
  console.log("escalera: PASA");

  const alemanes = todos.filter((j) => j.language === "german" && j.status !== "archived");
  const usados = [...new Set(alemanes.flatMap((j) => j.topics))];
  const labels = await p.topic.findMany({ where: { slug: { in: usados } }, select: { label: true } });

  await assertTopicsGrounded({
    language: "German",
    proposals: TEMAS.map(({ label, slug }) => ({ label, slug })),
    existingLabels: labels.map((l) => l.label),
    city: { mode: "single", city: CITY },
    prisma: p,
  });

  const choque = await p.topic.findMany({ where: { slug: { in: TEMAS.map((t) => t.slug) } } });
  if (choque.length) throw new Error(`slugs ya ocupados: ${choque.map((c) => c.slug).join(", ")}`);

  if (DRY) { console.log("\n--dry: no se escribe nada"); await p.$disconnect(); return; }

  for (const t of TEMAS) {
    await p.topic.create({ data: { slug: t.slug, label: t.label, isUniversal: false } });
    console.log(`  Topic  ${t.slug} => "${t.label}"`);
  }

  const j = await p.journey.create({
    data: {
      name: "Friends",
      language: "german",
      variant: "germany",
      typeSlug: "relationships",
      levels: ["b1"],
      topics: TEMAS.map((t) => t.slug),
      storiesPerTopic: 3,
      status: "draft",
      city: CITY,
      cityMode: "single",
    },
  });
  console.log(`\n  Journey ${j.id} (draft, b1, germany, ${CITY})`);

  for (const t of TEMAS) {
    for (let slot = 1; slot <= 3; slot++) {
      await p.journeyStory.create({
        data: { journeyId: j.id, level: "b1", topic: t.slug, slotIndex: slot, status: "draft" },
      });
    }
  }
  console.log(`  21 slots creados`);

  await p.$disconnect();
})();
