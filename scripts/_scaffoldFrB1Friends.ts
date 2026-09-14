/**
 * Monta el Friends FR/France B1: 7 temas x 3 historias = 21 slots, en draft.
 *
 * Plan aprobado el 2026-09-14 (docs/plan-fr-b1-friends.md). Tipo
 * `relationships`, como el A0 (Marseille), el A1 (Paris) y el A2 (Nantes) de la
 * misma escalera, con reparto propio: Aurelien y Elodie en Lille.
 *
 * El corpus frances tiene dos frases de proposito de dos personas, menos que
 * temas: por eso va en modo journey-level, con la escasez declarada.
 *
 *   npx tsx scripts/_scaffoldFrB1Friends.ts [--dry]
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
  "I plan to move there in 6-8 months",
  "still struggle feeling  confident with my comprehension",
];

const LABELS = [
  "Careers & Ambitions",
  "Advice & Opinions",
  "Money & Debts",
  "Rumours & Reputation",
  "Dating & Romance",
  "Stress & Burnout",
  "Pride & Envy",
];
const slugDe = (l: string) => l.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const TEMAS = LABELS.map((label) => ({ label, slug: slugDe(label) }));

async function main() {
  const dry = process.argv.includes("--dry");
  const nuevo = { name: "Friends", language: "french", variant: "france", levels: ["b1"] };

  const todos = await prisma.journey.findMany({
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true, topics: true },
  });
  const yaHay = todos.find((j) => j.language === "french" && j.variant === "france" && j.name === "Friends"
    && j.levels.includes("b1") && j.status !== "archived");
  if (yaHay) throw new Error(`Ya existe un Friends FR B1 (${yaHay.id}, ${yaHay.status}); no se crea otro.`);

  assertLadderContiguous(nuevo, todos);

  const labelsPrevias = (await prisma.topic.findMany({
    where: { slug: { in: todos.filter((j) => j.language === "french" && j.status !== "archived").flatMap((j) => j.topics) } },
    select: { label: true },
  })).map((t) => t.label);
  await assertTopicsGrounded({
    language: "French",
    proposals: TEMAS.map((t) => ({ label: t.label, slug: t.slug })),
    journeyEvidence: CITAS_DEL_JOURNEY,
    existingLabels: labelsPrevias,
    prisma,
  });

  const typeSlug = await assertJourneyType({ typeSlug: "relationships", name: "Friends", prisma });

  const conflictos: string[] = [];
  for (const t of TEMAS) {
    const porSlug = await prisma.topic.findFirst({ where: { slug: t.slug }, select: { label: true } });
    if (porSlug && porSlug.label !== t.label) conflictos.push(`${t.slug} ya es "${porSlug.label}"`);
    const porLabel = await prisma.topic.findFirst({ where: { label: t.label }, select: { slug: true } });
    if (porLabel && porLabel.slug !== t.slug) conflictos.push(`"${t.label}" ya lo usa ${porLabel.slug}`);
  }
  if (conflictos.length) throw new Error(`CHOQUE DE TEMAS:\n  - ${conflictos.join("\n  - ")}`);

  console.log(`tipo: ${typeSlug} · 7 temas · 21 historias · nivel b1 · draft`);
  if (dry) { console.log("[--dry] nada escrito."); return; }

  for (const t of TEMAS) {
    await prisma.topic.upsert({
      where: { slug: t.slug },
      update: { label: t.label },
      create: { slug: t.slug, label: t.label, isUniversal: false },
    });
  }

  const slots = TEMAS.flatMap((t) =>
    [0, 1, 2].map((i) => ({ level: "b1", topic: t.slug, slotIndex: i, status: "draft" as const })));
  const j = await prisma.journey.create({
    data: {
      name: "Friends", language: "french", variant: "france",
      typeSlug, levels: ["b1"], topics: TEMAS.map((t) => t.slug),
      storiesPerTopic: 3, status: "draft",
      stories: { create: slots },
    },
    select: { id: true, name: true, typeSlug: true },
  });
  console.log(`journey creado: ${j.id} (${j.name}, ${j.typeSlug}) con ${slots.length} slots`);
  console.log("El nextJourneyId del A2 NO se toca: se enlaza al publicar.");
}

main()
  .catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
