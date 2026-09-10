/**
 * Crea el journey Traveler ES/latam B2 en DRAFT: 7 filas de `Topic`, la fila de
 * `Journey`, los 21 slots vacios de `JourneyStory` y el puntero del B1 a este.
 *
 * Pasa por `assertTopicsGrounded` (desde el 2026-09-04 AVISA de los temas sin
 * cita en vez de bloquearlos; las reglas de nombre siguen tirando). Cada tema
 * cita, verbatim, lo que un solicitante de espanol ESCRIBIO en la base.
 *
 *   npx tsx scripts/_b2/_createB2Latam.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { assertTopicsGrounded, type TopicProposal } from "../../src/lib/topicEvidence";

const p = new PrismaClient();
const DRY = process.argv.includes("--dry");
const B1_ID = "cmtmylg7k0007321h6t7njesx";

/** Los siete, en orden de lectura. `country` va a LATAM_TOPIC_COUNTRY. */
const TEMAS: Array<TopicProposal & { country: string }> = [
  { label: "Jokes & Double Meanings", slug: "jokes-and-double-meanings", country: "mexico", evidence: [
    "I want to be able to understand and use slang from Colombia, México, and Paraguay",
    "he never seems to translate the way I would translate myself",
  ] },
  { label: "Negotiations & Courtesies", slug: "negotiations-and-courtesies", country: "peru", evidence: [
    "Conduct full business meetings in Spanish",
    "Improvement in practical conversation is important",
  ] },
  { label: "Secrets & Silences", slug: "secrets-and-silences", country: "chile", evidence: [
    "be fluent, and know peoples secrets",
  ] },
  { label: "Classes & Teachers", slug: "classes-and-teachers", country: "argentina", evidence: [
    "Spanish classes in high school and college and apps haven't worked for me",
    "I would like to try out this method of learning instead of books and classes",
  ] },
  { label: "Fluency & Forgetting", slug: "fluency-and-forgetting", country: "colombia", evidence: [
    "i've lost that fluency and would like to get it back",
    "became fluent enough to be taken as a native speaker",
  ] },
  { label: "Partners & In-Laws", slug: "partners-and-in-laws", country: "argentina", evidence: [
    "I want to have my own conversations with her",
    "my girlfriend is from argentina",
    "I started to learn Spanish for my new girlfriend",
  ] },
  { label: "Tales & Tall Stories", slug: "tales-and-tall-stories", country: "colombia", evidence: [
    "picking up Gabriel Garcia Marquéz's short stories",
    "I really enjoy story-based learning to maintain and practice my level of Spanish",
  ] },
];

(async () => {
  const otros = await p.journey.findMany({
    where: { language: "spanish", status: { in: ["active", "draft"] as never[] } },
    select: { topics: true },
  });
  const usados = [...new Set(otros.flatMap((j) => j.topics))];
  const labels = await p.topic.findMany({ where: { slug: { in: usados } }, select: { label: true } });

  await assertTopicsGrounded({
    language: "Spanish",
    proposals: TEMAS.map(({ label, slug, evidence }) => ({ label, slug, evidence })),
    existingLabels: labels.map((l) => l.label),
    prisma: p,
  });

  const choque = await p.topic.findMany({ where: { slug: { in: TEMAS.map((t) => t.slug!) } } });
  if (choque.length) throw new Error(`slugs ya ocupados: ${choque.map((c) => c.slug).join(", ")}`);

  if (DRY) { console.log("--dry: no se escribe nada"); await p.$disconnect(); return; }

  for (const t of TEMAS) {
    await p.topic.create({ data: { slug: t.slug!, label: t.label, isUniversal: false } });
    console.log(`  Topic  ${t.slug} => "${t.label}"`);
  }

  const j = await p.journey.create({
    data: {
      name: "Traveler",
      language: "spanish",
      variant: "latam",
      typeSlug: "traveler",
      levels: ["b2"],
      topics: TEMAS.map((t) => t.slug!),
      storiesPerTopic: 3,
      status: "draft",
    },
  });
  console.log(`\n  Journey ${j.id} (draft, b2, latam)`);

  for (const t of TEMAS) {
    for (let slot = 1; slot <= 3; slot++) {
      await p.journeyStory.create({
        data: { journeyId: j.id, level: "b2", topic: t.slug!, slotIndex: slot, status: "draft" },
      });
    }
  }
  console.log(`  21 slots creados`);

  await p.journey.update({ where: { id: B1_ID }, data: { nextJourneyId: j.id } });
  console.log(`  B1 ${B1_ID} -> next = ${j.id}`);

  await p.$disconnect();
})();
