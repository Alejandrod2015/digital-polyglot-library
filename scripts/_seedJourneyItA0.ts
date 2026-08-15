/**
 * Siembra el journey Traveler · italian/italy · A0 con sus 7 temas y sus 21
 * slots vacíos. Copia de `_seedJourneyPtBr.ts` con UNA diferencia: la guarda
 * de existencia mira también el NOMBRE, porque en italiano ya hay un journey
 * A0 (Friends, en borrador) y la guarda del original lo habría tomado por
 * este y no habría sembrado nada.
 *
 * No escribe `text` ni `vocab`: el contenido entra solo por saveStory.ts.
 *
 *   npx tsx scripts/_seedJourneyItA0.ts --dry
 *   npx tsx scripts/_seedJourneyItA0.ts --apply
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Cada tema nombra el DOMINIO LÉXICO de sus tres historias, nunca una ciudad:
// "Firenze" le dice el tema a un italiano y nada al público anglosajón. Dos
// slugs se reusan del Traveler brasileño a propósito (1 slug = 1 label global,
// así que comparten etiqueta y eso es lo correcto: son el mismo dominio).
const TOPICS = [
  { slug: "trains-tickets", label: "Trains & Tickets" },
  { slug: "coffee-bars", label: "Coffee & Bars" },
  { slug: "eating-out", label: "Eating Out" },
  { slug: "markets-money", label: "Markets & Money" },
  { slug: "churches-squares", label: "Churches & Squares" },
  { slug: "meeting-people", label: "Meeting People" },
  { slug: "sea-islands", label: "Sea & Islands" },
];

const JOURNEY = {
  name: "Traveler",
  language: "italian",
  variant: "italy",
  levels: ["a0"],
  storiesPerTopic: 3,
  status: "draft" as const,
};

async function main() {
  // Ninguna etiqueta nueva puede chocar con un slug viejo: 1 slug = 1 label
  // global, y dos slugs con la misma etiqueta confunden al alumno.
  const clashes = await p.topic.findMany({
    where: { label: { in: TOPICS.map((t) => t.label) } },
    select: { slug: true, label: true },
  });
  const bad = clashes.filter((c) => c.slug !== TOPICS.find((t) => t.label === c.label)!.slug);
  if (bad.length) {
    throw new Error(
      `etiquetas ya usadas por otro slug (elige otras):\n` +
        bad.map((c) => `  "${c.label}" -> ${c.slug}`).join("\n"),
    );
  }

  const existing = await p.journey.findFirst({
    where: {
      name: JOURNEY.name,
      language: JOURNEY.language,
      variant: JOURNEY.variant,
      levels: { has: "a0" },
    },
  });
  if (existing) {
    console.log(`YA EXISTE: ${existing.name} ${existing.language}/${existing.variant} (${existing.id}) — nada que hacer`);
    return;
  }

  const maxOrder = (await p.topic.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;

  console.log(`${APPLY ? "APLICANDO" : "DRY RUN"}\n`);
  console.log(`Journey: ${JOURNEY.name} · ${JOURNEY.language}/${JOURNEY.variant} · a0 · ${JOURNEY.status}`);
  TOPICS.forEach((t, i) => console.log(`  ${i + 1}. ${t.slug.padEnd(20)} -> ${t.label}`));
  console.log(`\n21 slots: 7 temas x 3 (level a0, status draft, sin texto ni vocab)`);

  if (!APPLY) {
    console.log("\n(dry run, no se escribió nada; corre con --apply)");
    return;
  }

  for (const [i, t] of TOPICS.entries()) {
    await p.topic.upsert({
      where: { slug: t.slug },
      update: { label: t.label },
      create: { slug: t.slug, label: t.label, isUniversal: false, sortOrder: maxOrder + 1 + i },
    });
  }

  const journey = await p.journey.create({
    data: { ...JOURNEY, topics: TOPICS.map((t) => t.slug) },
  });

  await p.journeyStory.createMany({
    data: TOPICS.flatMap((t) =>
      [1, 2, 3].map((slotIndex) => ({
        journeyId: journey.id,
        level: "a0",
        topic: t.slug,
        slotIndex,
        status: "draft" as const,
      })),
    ),
  });

  const n = await p.journeyStory.count({ where: { journeyId: journey.id } });
  console.log(`\nListo. Journey ${journey.id} con ${n} slots.`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
