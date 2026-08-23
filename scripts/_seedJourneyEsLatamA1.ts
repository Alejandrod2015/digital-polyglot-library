/**
 * Siembra el journey Traveler · spanish/latam · A1 con sus 7 temas y sus 21
 * slots vacíos. Aditivo, como `_seedJourneyEsA1.ts`.
 *
 * No escribe `text` ni `vocab`: el contenido entra solo por saveStory.ts.
 *
 * Los siete temas pasan por `assertTopicsGrounded` ANTES de escribirse: cada
 * uno cita, literal, una frase que un solicitante de español ESCRIBIÓ en
 * `BetaSignup` (los clics del desplegable no cuentan). Siete citas distintas
 * de seis personas distintas; ninguna se reusa en dos temas.
 *
 *   npx tsx scripts/_seedJourneyEsLatamA1.ts --dry
 *   npx tsx scripts/_seedJourneyEsLatamA1.ts --apply
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";

const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/**
 * Etiquetas en inglés (la UI del alumno lo es) y cada una nombra el DOMINIO
 * LÉXICO de sus tres historias, no la ciudad: un Traveler recorre destinos,
 * pero "Cusco" no le dice a un anglosajón qué palabras va a aprender.
 *
 * Los siete dominios se eligieron por el campo léxico que los OTROS journeys
 * de español NO tocan: el A0 latam y el A0 de México ya agotaron mercado,
 * casa, fiesta, montaña y leyenda, y el A1 de España el bar, la compra y la
 * farmacia. Lo que queda sin tocar es el viaje POR DENTRO: la terminal, el
 * cuarto alquilado, el vuelto, el teléfono, lo que se rompe y el oficio de
 * quien te lleva.
 */
const TOPICS = [
  {
    slug: "night-buses",
    label: "Night Buses",
    evidence: ["speak Spanish when travelling"],
  },
  {
    slug: "rooms-and-keys",
    label: "Rooms & Keys",
    evidence: ["Holiday home in Spain"],
  },
  {
    slug: "prices-and-change",
    label: "Prices & Change",
    evidence: ["Conduct full business meetings"],
  },
  {
    slug: "calls-and-messages",
    label: "Calls & Messages",
    evidence: ["I want to have my own conversations with her"],
  },
  {
    slug: "help-and-repairs",
    label: "Help & Repairs",
    evidence: ["reached for or fixed"],
  },
  {
    slug: "names-for-things",
    label: "Names for Things",
    evidence: ["understand and use slang from Colombia"],
  },
  {
    slug: "drivers-and-guides",
    label: "Drivers & Guides",
    evidence: ["for my job and friends"],
  },
];

const JOURNEY = {
  name: "Traveler",
  language: "spanish",
  variant: "latam",
  typeSlug: "traveler",
  levels: ["a1"],
  storiesPerTopic: 3,
  status: "draft" as const,
};

async function main() {
  // Lo que ya cubren los otros journeys de español, para verlo al lado.
  const hermanos = await p.journey.findMany({
    where: { language: "spanish", status: { not: "archived" } },
    select: { topics: true },
  });
  const existingLabels = [...new Set(hermanos.flatMap((j) => j.topics))];

  await assertTopicsGrounded({
    language: "spanish",
    proposals: TOPICS.map((t) => ({ label: t.label, slug: t.slug, evidence: t.evidence })),
    existingLabels,
    prisma: p,
  });

  const clashes = await p.topic.findMany({
    where: { OR: [{ slug: { in: TOPICS.map((t) => t.slug) } }, { label: { in: TOPICS.map((t) => t.label) } }] },
    select: { slug: true, label: true },
  });
  const bad = clashes.filter((c) => {
    const mio = TOPICS.find((t) => t.slug === c.slug);
    return !mio || mio.label !== c.label;
  });
  if (bad.length) {
    throw new Error(
      `slug o etiqueta ya usados por otro tema (un slug = un label, global):\n` +
        bad.map((c) => `  "${c.label}" -> ${c.slug}`).join("\n"),
    );
  }

  // El A1 latam ARCHIVADO existe (estructura vieja, 7x7); no cuenta.
  const existing = await p.journey.findFirst({
    where: {
      language: JOURNEY.language, variant: JOURNEY.variant,
      levels: { has: "a1" }, status: { not: "archived" },
    },
  });
  if (existing) {
    console.log(`YA EXISTE (${existing.id}); nada que hacer`);
    return;
  }

  console.log(`${APPLY ? "APLICANDO" : "DRY RUN"}\n`);
  console.log(`${JOURNEY.name} · ${JOURNEY.language}/${JOURNEY.variant} · a1 · ${JOURNEY.status}`);
  TOPICS.forEach((t, i) => console.log(`  ${i + 1}. ${t.slug.padEnd(20)} -> ${t.label}`));
  console.log(`\n21 slots: 7 temas x 3 (level a1, status draft, sin texto ni vocab)`);

  if (!APPLY) {
    console.log("\n(dry run, no se escribió nada)");
    return;
  }

  const maxOrder = (await p.topic.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
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
