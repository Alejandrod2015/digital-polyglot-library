/**
 * Crea el Traveler ES/spain A2: los 7 temas (pasando por `assertTopicsGrounded`),
 * la fila de Journey y los 21 huecos de JourneyStory vacios.
 *
 * El contenido de las historias NO se escribe aqui: entra por saveStory.ts.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { assertTopicsGrounded } from "../../src/lib/topicEvidence";
import { A2_TOPICS, A2_EXISTING_LABELS } from "./proposeTopics";

const prisma = new PrismaClient();

(async () => {
  await assertTopicsGrounded({
    language: "spanish", proposals: A2_TOPICS,
    existingLabels: A2_EXISTING_LABELS, prisma,
  });

  const tipo = await prisma.journeyType.findUnique({ where: { slug: "traveler" } });
  if (!tipo) throw new Error("no existe el JourneyType traveler");

  // `isUniversal: false` a proposito: con true el tema entra en la lista
  // universal del Studio y en el seed de cualquier journey nuevo.
  for (const [i, t] of A2_TOPICS.entries()) {
    const ya = await prisma.topic.findUnique({ where: { slug: t.slug! } });
    if (ya) {
      if (ya.label !== t.label) throw new Error(`el slug ${t.slug} ya existe con otro label ("${ya.label}"): un slug = un label global`);
      console.log(`  = ${t.slug} ya existia`);
      continue;
    }
    const fila = await prisma.topic.create({
      data: { slug: t.slug!, label: t.label, isUniversal: false, sortOrder: i },
    });
    await prisma.topicJourneyType.create({ data: { topicId: fila.id, journeyTypeId: tipo.id } });
    console.log(`  + ${t.slug}  "${t.label}"`);
  }

  const existe = await prisma.journey.findFirst({
    where: { language: "spanish", variant: "spain", typeSlug: "traveler", levels: { has: "a2" } },
  });
  if (existe) { console.log(`\nEl journey ya existe: ${existe.id}`); return; }

  const j = await prisma.journey.create({
    data: {
      name: "Traveler", language: "spanish", variant: "spain", typeSlug: "traveler",
      levels: ["a2"], topics: A2_TOPICS.map((t) => t.slug!), storiesPerTopic: 3,
      status: "draft",
    },
  });
  for (const slug of A2_TOPICS.map((t) => t.slug!))
    for (let i = 1; i <= 3; i++)
      await prisma.journeyStory.create({
        data: { journeyId: j.id, level: "a2", topic: slug, slotIndex: i, status: "draft" },
      });
  console.log(`\nJourney ${j.id} creado (draft) con 21 huecos.`);
})().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); })
  .finally(() => prisma.$disconnect());
