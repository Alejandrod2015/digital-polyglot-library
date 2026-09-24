/**
 * Monta el Friends ES Colombia A0 (Medellin): 7 temas x 3 historias = 21 slots, en draft.
 * Encargo: ENCARGO.md, fase 1 texto, 2026-09-23.
 *
 * Tipo `relationships`, nombre "Friends". El C1 colombiano publicado esta
 * excluido de la escalera por decision explicita del usuario en journeyLadder.
 *
 *   npx tsx scripts/_scaffoldFriendsESColA0.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";
import { assertJourneyType } from "../src/lib/journeyType";
import { assertLadderContiguous } from "../src/lib/journeyLadder";

const prisma = new PrismaClient();

const CITAS_DEL_JOURNEY = [
  "I want to be able to understand and use slang from Colombia",
  "i lived for a year in Colombia",
  "to be able to talk to people",
];

const TEMAS: Array<{ slug: string; label: string }> = [
  { slug: "greetings-and-introductions", label: "Greetings & Introductions" },
  { slug: "coffee-and-bread", label: "Coffee & Bread" },
  { slug: "buses-and-streets", label: "Buses & Streets" },
  { slug: "work-and-favors", label: "Work & Favors" },
  { slug: "phones-and-messages", label: "Phones & Messages" },
  { slug: "cash-and-errands", label: "Cash & Errands" },
  { slug: "parties-and-photos", label: "Parties & Photos" },
];

async function main() {
  const dry = process.argv.includes("--dry");
  const NUEVO = { name: "Friends", language: "spanish", variant: "colombia", levels: ["a0"] };

  const yaHay = await prisma.journey.findFirst({
    where: {
      language: "spanish",
      variant: "colombia",
      name: "Friends",
      levels: { has: "a0" },
      status: { not: "archived" },
    },
    select: { id: true },
  });
  if (yaHay) throw new Error(`ya existe el Friends ES Colombia A0: ${yaHay.id}`);

  const todos = await prisma.journey.findMany({
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true, topics: true },
  });
  assertLadderContiguous(NUEVO, todos);

  const spanish = todos.filter((j) => j.language === "spanish" && j.status !== "archived").flatMap((j) => j.topics);
  const labelsPrevias = (await prisma.topic.findMany({
    where: { slug: { in: spanish } },
    select: { label: true },
  })).map((t) => t.label);
  await assertTopicsGrounded({
    language: "Spanish",
    proposals: TEMAS.map((t) => ({ label: t.label, slug: t.slug })),
    journeyEvidence: CITAS_DEL_JOURNEY,
    existingLabels: labelsPrevias,
    prisma,
  });

  const typeSlug = await assertJourneyType({ typeSlug: "relationships", name: "Friends", prisma });

  const conflictos: string[] = [];
  for (const t of TEMAS) {
    const porSlug = await prisma.topic.findFirst({ where: { slug: t.slug }, select: { label: true } });
    if (porSlug) conflictos.push(`${t.slug} ya existe como "${porSlug.label}"`);
    const porLabel = await prisma.topic.findFirst({ where: { label: t.label }, select: { slug: true } });
    if (porLabel) conflictos.push(`"${t.label}" ya lo usa ${porLabel.slug}`);
  }
  if (conflictos.length) throw new Error(`CHOQUE DE TEMAS:\n  - ${conflictos.join("\n  - ")}`);

  console.log("ciudad: Medellin, Colombia");
  console.log(`tipo: ${typeSlug} · 7 temas · 21 historias · nivel a0 · draft`);
  if (dry) {
    console.log("[--dry] nada escrito.");
    return;
  }

  for (const t of TEMAS) {
    await prisma.topic.create({ data: { slug: t.slug, label: t.label, isUniversal: false } });
  }
  const slots = TEMAS.flatMap((t) =>
    [0, 1, 2].map((i) => ({ level: "a0", topic: t.slug, slotIndex: i, status: "draft" as const })),
  );
  const j = await prisma.journey.create({
    data: {
      ...NUEVO,
      typeSlug,
      topics: TEMAS.map((t) => t.slug),
      storiesPerTopic: 3,
      status: "draft",
      stories: { create: slots },
    },
    select: { id: true },
  });
  console.log(`JOURNEY_ID=${j.id} con ${slots.length} slots`);
}

main()
  .catch((e) => {
    console.error("FALLO:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
