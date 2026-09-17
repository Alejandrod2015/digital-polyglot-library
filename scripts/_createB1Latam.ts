/**
 * Crea el journey Traveler ES/latam B1 en DRAFT: 7 filas de `Topic`, la fila de
 * `Journey`, los 21 slots vacios de `JourneyStory` y el puntero del A2 a este.
 *
 * Pasa por `assertTopicsGrounded`, que desde el 2026-09-04 AVISA de los temas
 * sin cita de usuario en vez de bloquearlos, y sigue tirando si un nombre rompe
 * las reglas (2-4 palabras, ampersand, Title Case, sin pais, sin articulo,
 * slug derivado del nombre).
 *
 *   npx tsx scripts/_createB1Latam.ts [--dry]
 */
import { config } from "dotenv"; config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded, type TopicProposal } from "../src/lib/topicEvidence";

const p = new PrismaClient();
const DRY = process.argv.includes("--dry");
const A2_ID = "cmtgelq560007j84n3ujx9bpd";

/** Los siete, en orden de lectura. `country` va a LATAM_TOPIC_COUNTRY. */
const TEMAS: Array<TopicProposal & { country: string }> = [
  { label: "Promises & Excuses",    slug: "promises-and-excuses",    country: "argentina", evidence: [] },
  { label: "Advice & Opinions",     slug: "advice-and-opinions",     country: "colombia",  evidence: ["from the real pepole living there point of view"] },
  { label: "Faith & Devotion",      slug: "faith-and-devotion",      country: "peru",      evidence: [] },
  { label: "Animals & Farms",       slug: "animals-and-farms",       country: "chile",     evidence: [] },
  { label: "Games & Bets",          slug: "games-and-bets",          country: "mexico",    evidence: [] },
  { label: "Pride & Envy",          slug: "pride-and-envy",          country: "argentina", evidence: ["be fluent, and know peoples secrets"] },
  { label: "Distance & Homecoming", slug: "distance-and-homecoming", country: "colombia",  evidence: ["enlarge my social, language and cultural skills to other countries than Spain"] },
];

(async () => {
  const otros = await p.journey.findMany({
    where: { language: "spanish", status: { in: ["active", "draft"] as any } },
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
      levels: ["b1"],
      topics: TEMAS.map((t) => t.slug!),
      storiesPerTopic: 3,
      status: "draft",
    },
  });
  console.log(`\n  Journey ${j.id} (draft, b1, latam)`);

  for (const t of TEMAS) {
    for (let slot = 1; slot <= 3; slot++) {
      await p.journeyStory.create({
        data: { journeyId: j.id, level: "b1", topic: t.slug!, slotIndex: slot, status: "draft" },
      });
    }
  }
  console.log(`  21 slots creados`);

  await p.journey.update({ where: { id: A2_ID }, data: { nextJourneyId: j.id } });
  console.log(`  A2 ${A2_ID} -> next = ${j.id}`);

  await p.$disconnect();
})();
