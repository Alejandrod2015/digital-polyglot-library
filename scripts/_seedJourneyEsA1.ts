/**
 * Siembra el journey Friends · spanish/spain · A1 con sus 7 temas y sus 21
 * slots vacíos. Aditivo, como `_seedJourneyPtBr.ts`.
 *
 * No escribe `text` ni `vocab`: el contenido entra solo por saveStory.ts.
 * Brief: docs/a1-spain-brief.md
 *
 *   npx tsx scripts/_seedJourneyEsA1.ts --dry
 *   npx tsx scripts/_seedJourneyEsA1.ts --apply
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Etiquetas en inglés: la UI del alumno es inglesa. Los dominios salen de las
// 23 motivaciones escritas en BetaSignup (8 viaje, 6 gusto, 3 familia) y de la
// del único lector activo del A0 España: casa de vacaciones y hablar con los
// vecinos.
const TOPICS = [
  { slug: "neighbours", label: "Neighbours" },
  { slug: "the-local-bar", label: "The Local Bar" },
  { slug: "shopping-for-food", label: "Shopping for Food" },
  { slug: "spanish-hours", label: "Spanish Hours" },
  { slug: "around-the-house", label: "Around the House" },
  { slug: "chemist-and-doctor", label: "Chemist & Doctor" },
  { slug: "village-fiesta", label: "Village Fiesta" },
];

const JOURNEY = {
  name: "Friends",
  language: "spanish",
  variant: "spain",
  levels: ["a1"],
  storiesPerTopic: 3,
  status: "draft" as const,
};

async function main() {
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
    where: { language: JOURNEY.language, variant: JOURNEY.variant, levels: { has: "a1" } },
  });
  if (existing) {
    console.log(`YA EXISTE (${existing.id}); nada que hacer`);
    return;
  }

  const maxOrder = (await p.topic.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;

  console.log(`${APPLY ? "APLICANDO" : "DRY RUN"}\n`);
  console.log(`${JOURNEY.name} · ${JOURNEY.language}/${JOURNEY.variant} · a1 · ${JOURNEY.status}`);
  TOPICS.forEach((t, i) => console.log(`  ${i + 1}. ${t.slug.padEnd(20)} -> ${t.label}`));
  console.log(`\n21 slots: 7 temas x 3 (level a1, status draft, sin texto ni vocab)`);

  if (!APPLY) {
    console.log("\n(dry run, no se escribió nada)");
    return;
  }

  for (const [i, t] of TOPICS.entries()) {
    await p.topic.upsert({
      where: { slug: t.slug },
      update: { label: t.label },
      create: { slug: t.slug, label: t.label, isUniversal: false, sortOrder: maxOrder + 1 + i },
    });
  }

  const journey = await p.journey.create({ data: { ...JOURNEY, topics: TOPICS.map((t) => t.slug) } });

  await p.journeyStory.createMany({
    data: TOPICS.flatMap((t) =>
      [1, 2, 3].map((slotIndex) => ({
        journeyId: journey.id,
        level: "a1",
        topic: t.slug,
        slotIndex,
        status: "draft" as const,
      })),
    ),
  });

  const n = await p.journeyStory.count({ where: { journeyId: journey.id } });
  console.log(`\nListo. Journey ${journey.id} con ${n} slots.`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); }).finally(() => p.$disconnect());
