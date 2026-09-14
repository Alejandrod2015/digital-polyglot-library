/**
 * Monta el Friends IT A1 (Milano): 7 temas x 3 historias = 21 slots, en draft.
 * Plan aprobado: docs/plan-it-a1-friends.md (2026-09-14, via Journey-planning-2).
 *
 * Tipo `relationships`, nombre "Friends". Las citas sostienen el journey entero
 * (modo journey-level): en italiano solo hay una frase de proposito, de dos
 * personas detras. Peldano siguiente al Friends IT A0 de Genova
 * (cmu0dpa3i0007j80ugstn0jf0).
 *
 *   npx tsx scripts/_scaffoldFriendsITa1.ts [--dry]
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
  "I will be going on a solo trip to Italy",
  "understand and speak some basic Italian",
  "as I learn foreign languages",
];

const TEMAS: Array<{ slug: string; label: string }> = [
  { slug: "pets-and-strays", label: "Pets & Strays" },
  { slug: "work-and-shifts", label: "Work & Shifts" },
  { slug: "neighbours-and-noise", label: "Neighbours & Noise" },
  { slug: "bills-and-expenses", label: "Bills & Expenses" },
  { slug: "repairs-and-diy", label: "Repairs & DIY" },
  { slug: "summer-and-holidays", label: "Summer & Holidays" },
  { slug: "couples-and-living-together", label: "Couples & Living Together" },
];

async function main() {
  const dry = process.argv.includes("--dry");
  const NUEVO = { name: "Friends", language: "italian", variant: "italy", levels: ["a1"] };

  const yaHay = await prisma.journey.findFirst({
    where: { language: "italian", variant: "italy", name: "Friends", levels: { has: "a1" }, status: { not: "archived" } },
    select: { id: true },
  });
  if (yaHay) throw new Error(`ya existe el Friends IT A1: ${yaHay.id}`);

  const todos = await prisma.journey.findMany({
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true, topics: true },
  });
  assertLadderContiguous(NUEVO, todos);

  const italiano = todos.filter((j) => j.language === "italian" && j.status !== "archived").flatMap((j) => j.topics);
  const labelsPrevias = (await prisma.topic.findMany({ where: { slug: { in: italiano } }, select: { label: true } })).map((t) => t.label);
  await assertTopicsGrounded({
    language: "Italian",
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

  console.log(`tipo: ${typeSlug} · 7 temas · 21 historias · nivel a1 · draft`);
  if (dry) { console.log("[--dry] nada escrito."); return; }

  for (const t of TEMAS) {
    await prisma.topic.create({ data: { slug: t.slug, label: t.label, isUniversal: false } });
  }
  const slots = TEMAS.flatMap((t) => [0, 1, 2].map((i) => ({ level: "a1", topic: t.slug, slotIndex: i, status: "draft" as const })));
  const j = await prisma.journey.create({
    data: { ...NUEVO, typeSlug, topics: TEMAS.map((t) => t.slug), storiesPerTopic: 3, status: "draft", stories: { create: slots } },
    select: { id: true },
  });
  console.log(`JOURNEY_ID=${j.id} con ${slots.length} slots`);
}

main()
  .catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
