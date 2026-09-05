/**
 * Cambia los dos temas del Traveler ES/spain B1 que solo existen en un pueblo
 * de costa. El journey se muda a Granada con protagonista nueva (Celia), asi
 * que `winter-and-empty-houses` y `storms-and-the-sea` dejan de tener sitio.
 * Los otros cinco valen igual o mejor en ciudad y se quedan como estan.
 *
 * Los dos slugs se crean. No se borra ninguna fila vieja y no se toca ninguna JourneyStory: las
 * 21 se reescriben aparte, por `saveStory.ts`.
 */
import { PrismaClient } from "@/generated/prisma";
import { assertTopicsGrounded, type TopicProposal } from "@/lib/topicEvidence";

const prisma = new PrismaClient();
const JOURNEY_ID = "cmt5x67ze000l320cpgunu5vi";

const PROPOSALS: (TopicProposal & { slug: string })[] = [
  { slug: "rooms-and-landlords", label: "Rooms & Landlords",
    evidence: ["I wish to talk to neighbours"] },
  // `meetings-presentations` ya existe pero su slug no deriva de su label, que
  // es lo que exige la regla de hoy, asi que no se puede reutilizar.
  { slug: "meetings-and-deadlines", label: "Meetings & Deadlines",
    evidence: ["Conduct full business meetings in Spanish"] },
];

async function main() {
  const j = await prisma.journey.findUnique({ where: { id: JOURNEY_ID } });
  if (!j) throw new Error(`No existe el journey ${JOURNEY_ID}`);
  console.log(`Temas actuales: ${j.topics.join(", ")}`);

  await assertTopicsGrounded({ language: j.language, proposals: PROPOSALS, prisma });

  const existing = await prisma.topic.findMany({ where: { slug: { in: PROPOSALS.map((p) => p.slug) } } });
  const choques = existing.filter((row) => {
    const want = PROPOSALS.find((p) => p.slug === row.slug);
    return want && row.label !== want.label;
  });
  if (choques.length) throw new Error(`Slugs con OTRO label: ${choques.map((c) => `${c.slug} = "${c.label}"`).join("; ")}`);

  const have = new Set(existing.map((r) => r.slug));
  for (const p of PROPOSALS)
    if (!have.has(p.slug)) { await prisma.topic.create({ data: { slug: p.slug, label: p.label, isUniversal: false } }); console.log("creado:", p.slug); }

  const nuevos = j.topics.map((t) =>
    t === "winter-and-empty-houses" ? "rooms-and-landlords" :
    t === "storms-and-the-sea" ? "meetings-and-deadlines" : t);
  await prisma.journey.update({ where: { id: JOURNEY_ID }, data: { topics: nuevos } });
  console.log("\nArray final:");
  nuevos.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e instanceof Error ? e.message : e); await prisma.$disconnect(); process.exit(1); });
