/**
 * Reemplaza los 7 temas del journey draft spanish/latam/a2 Traveler
 * (cmtgelq560007j84n3ujx9bpd) por los que salen de lo que los solicitantes
 * ESCRIBIERON en BetaSignup.
 *
 * Qué hace, en orden:
 *   1. Corre `assertTopicsGrounded` con los 7 temas y sus citas. Si tira, no
 *      se escribe nada.
 *   2. Crea en `dp_topics_v1` las filas que falten, con `isUniversal: false`.
 *   3. Pone el array `topics` del journey a los 7 slugs nuevos, en orden.
 *
 * Lo que NO hace, a propósito: no borra los temas viejos de la tabla
 * (neighbours-and-landlords, bosses-and-workmates, friends-of-friends,
 * doctors-and-nurses, teachers-and-customers, close-friends,
 * drivers-and-guides) y no toca ninguna fila de JourneyStory. Las 21
 * historias existentes se quedan colgadas de sus slugs viejos; es una
 * decisión consciente, no un olvido.
 */
import { PrismaClient } from "@/generated/prisma";
import { assertTopicsGrounded, type TopicProposal } from "@/lib/topicEvidence";

const prisma = new PrismaClient();
const JOURNEY_ID = "cmtgelq560007j84n3ujx9bpd";

const PROPOSALS: (TopicProposal & { slug: string })[] = [
  {
    slug: "friends-and-reunions",
    label: "Friends & Reunions",
    evidence: ["kept a lot of friends and strong links"],
  },
  {
    slug: "staying-with-locals",
    label: "Staying With Locals",
    evidence: ["I want to have my own conversations with her"],
  },
  {
    slug: "jokes-and-misunderstandings",
    label: "Jokes & Misunderstandings",
    evidence: ["WAY funnier then him"],
  },
  {
    slug: "borders-and-crossings",
    label: "Borders & Crossings",
    evidence: ["slang from Colombia, México, and Paraguay"],
  },
  {
    slug: "work-trips-and-meetings",
    label: "Work Trips & Meetings",
    evidence: ["for my job and friends"],
  },
  {
    slug: "secrets-and-curiosity",
    label: "Secrets & Curiosity",
    evidence: ["know peoples secrets"],
  },
  {
    slug: "local-life-and-routines",
    label: "Local Life & Routines",
    evidence: ["real pepole living there"],
  },
];

async function main() {
  const journey = await prisma.journey.findUnique({ where: { id: JOURNEY_ID } });
  if (!journey) throw new Error(`No existe el journey ${JOURNEY_ID}`);
  console.log(`Journey: ${journey.name} ${journey.language}/${journey.variant} ${journey.levels.join(",")} [${journey.status}]`);
  console.log(`Temas actuales: ${journey.topics.join(", ")}`);

  // Portón de evidencia: si un tema no cita algo que un usuario escribió, esto
  // tira y no se escribe nada.
  await assertTopicsGrounded({
    language: journey.language,
    proposals: PROPOSALS,
    prisma,
  });

  // Un slug = un label global: si la fila ya existe con otro nombre, se para.
  const existing = await prisma.topic.findMany({
    where: { slug: { in: PROPOSALS.map((p) => p.slug) } },
  });
  const clashes = existing.filter((row) => {
    const want = PROPOSALS.find((p) => p.slug === row.slug);
    return want && row.label !== want.label;
  });
  if (clashes.length) {
    throw new Error(
      `Slugs que ya existen con OTRO label: ${clashes.map((c) => `${c.slug} = "${c.label}"`).join("; ")}`,
    );
  }

  const have = new Set(existing.map((row) => row.slug));
  const created: string[] = [];
  for (const p of PROPOSALS) {
    if (have.has(p.slug)) continue;
    await prisma.topic.create({
      data: { slug: p.slug, label: p.label, isUniversal: false },
    });
    created.push(p.slug);
  }
  console.log(`\nFilas creadas en dp_topics_v1: ${created.length ? created.join(", ") : "ninguna (ya existían)"}`);

  await prisma.journey.update({
    where: { id: JOURNEY_ID },
    data: { topics: PROPOSALS.map((p) => p.slug) },
  });

  const after = await prisma.journey.findUnique({ where: { id: JOURNEY_ID } });
  console.log("\nArray final del journey:");
  after?.topics.forEach((slug, i) => console.log(`  ${i + 1}. ${slug}`));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
