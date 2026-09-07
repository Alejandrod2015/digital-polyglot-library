/**
 * Crea el journey Traveler ES/spain B2 en DRAFT: 7 filas de `Topic`, la fila de
 * `Journey`, los 21 slots vacios de `JourneyStory` y el puntero del B1 spain a
 * este. Calcado de `_createB1Latam.ts` (2026-09-04).
 *
 * Pasa por `assertTopicsGrounded`: cada tema cita, literal, algo que un
 * solicitante de espanol ESCRIBIO en BetaSignup. B2 es el nivel siguiente para
 * quienes cursan el B1 de Granada; las citas que sostienen estos temas son las
 * de los Intermediate/Advanced del corpus.
 *
 *   npx tsx scripts/_createB2Spain.ts [--dry]
 */
import { config } from "dotenv"; config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded, type TopicProposal } from "../src/lib/topicEvidence";

const p = new PrismaClient();
const DRY = process.argv.includes("--dry");
const B1_SPAIN_ID = "cmt5x67ze000l320cpgunu5vi";

/** Los siete, en orden de lectura. */
const TEMAS: Array<TopicProposal & { slug: string }> = [
  { label: "Accents & Origins", slug: "accents-and-origins",
    evidence: ["be taken as a native speaker"] },
  { label: "Humour & Comebacks", slug: "humour-and-comebacks",
    evidence: ["WAY funnier then him and he never seems to translate"] },
  { label: "Rounds & Regulars", slug: "rounds-and-regulars",
    evidence: ["Improvement in practical conversation is important"] },
  { label: "News & Headlines", slug: "news-and-headlines",
    evidence: ["read the news & social media"] },
  { label: "Wind & Plans", slug: "wind-and-plans",
    evidence: ["speak Spanish when travelling to Spain"] },
  { label: "Books & Bookshops", slug: "books-and-bookshops",
    evidence: ["story-based learning to maintain and practice my level of Spanish"] },
  { label: "Visits & Old Friends", slug: "visits-and-old-friends",
    evidence: ["kept a lot of friends and strong links with Spain"] },
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

  const choque = await p.topic.findMany({ where: { slug: { in: TEMAS.map((t) => t.slug) } } });
  if (choque.length) throw new Error(`slugs ya ocupados: ${choque.map((c) => c.slug).join(", ")}`);

  const b1 = await p.journey.findUnique({ where: { id: B1_SPAIN_ID } });
  if (!b1 || b1.variant !== "spain" || !b1.levels.includes("b1"))
    throw new Error(`El B1 spain ${B1_SPAIN_ID} no es el que se espera`);
  if (b1.nextJourneyId) throw new Error(`El B1 spain ya apunta a ${b1.nextJourneyId}`);

  if (DRY) { console.log("--dry: no se escribe nada"); await p.$disconnect(); return; }

  for (const t of TEMAS) {
    await p.topic.create({ data: { slug: t.slug, label: t.label, isUniversal: false } });
    console.log(`  Topic  ${t.slug} => "${t.label}"`);
  }

  const j = await p.journey.create({
    data: {
      name: "Traveler",
      language: "spanish",
      variant: "spain",
      typeSlug: "traveler",
      levels: ["b2"],
      topics: TEMAS.map((t) => t.slug),
      storiesPerTopic: 3,
      status: "draft",
    },
  });
  console.log(`\n  Journey ${j.id} (draft, b2, spain)`);

  for (const t of TEMAS) {
    for (let slot = 1; slot <= 3; slot++) {
      await p.journeyStory.create({
        data: { journeyId: j.id, level: "b2", topic: t.slug, slotIndex: slot, status: "draft" },
      });
    }
  }
  console.log(`  21 slots creados`);

  await p.journey.update({ where: { id: B1_SPAIN_ID }, data: { nextJourneyId: j.id } });
  console.log(`  B1 spain ${B1_SPAIN_ID} -> next = ${j.id}`);

  await p.$disconnect();
})();
