/**
 * Monta el Friends ES spain A2 (Salamanca): 7 temas x 3 historias = 21 slots, en draft.
 * Plan aprobado: docs/plan-es-a2-friends-spain.md (commit 51bba2bd, 2026-09-15, via Journey-planning-2).
 *
 * Tipo `relationships`, nombre "Friends". Peldano siguiente al Friends ES spain A1
 * (cmrr5hnbl000032k1esry5n8g). Las citas van en modo journey-level porque el porton
 * de temas todavia las exige al guardar; son pista (temas 2 y 6), no filtro.
 *
 *   npx tsx scripts/_scaffoldFriendsESa2Spain.ts [--dry]
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
  "My boyfriend and I have been dating for a year and a half now",
  "at least read the news & social media",
];

const TEMAS: Array<{ slug: string; label: string }> = [
  { slug: "music-and-bands", label: "Music & Bands" },
  { slug: "phones-and-social-media", label: "Phones & Social Media" },
  { slug: "driving-and-cars", label: "Driving & Cars" },
  { slug: "money-and-loans", label: "Money & Loans" },
  { slug: "clothes-and-looks", label: "Clothes & Looks" },
  { slug: "couples-and-dating", label: "Couples & Dating" },
  { slug: "fairs-and-street-parties", label: "Fairs & Street Parties" },
];

async function main() {
  const dry = process.argv.includes("--dry");
  const NUEVO = { name: "Friends", language: "spanish", variant: "spain", levels: ["a2"] };

  const yaHay = await prisma.journey.findFirst({
    where: { language: "spanish", variant: "spain", name: "Friends", levels: { has: "a2" }, status: { not: "archived" } },
    select: { id: true },
  });
  if (yaHay) throw new Error(`ya existe el Friends ES spain A2: ${yaHay.id}`);

  const todos = await prisma.journey.findMany({
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true, topics: true },
  });
  assertLadderContiguous(NUEVO, todos);

  const espanol = todos.filter((j) => j.language === "spanish" && j.status !== "archived").flatMap((j) => j.topics);
  const labelsPrevias = (await prisma.topic.findMany({ where: { slug: { in: espanol } }, select: { label: true } })).map((t) => t.label);
  await assertTopicsGrounded({
    language: "spanish",
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

  console.log(`tipo: ${typeSlug} · 7 temas · 21 historias · nivel a2 · draft`);
  if (dry) { console.log("[--dry] nada escrito."); return; }

  for (const t of TEMAS) {
    await prisma.topic.create({ data: { slug: t.slug, label: t.label, isUniversal: false } });
  }
  const slots = TEMAS.flatMap((t) => [0, 1, 2].map((i) => ({ level: "a2", topic: t.slug, slotIndex: i, status: "draft" as const })));
  const j = await prisma.journey.create({
    data: { ...NUEVO, typeSlug, topics: TEMAS.map((t) => t.slug), storiesPerTopic: 3, status: "draft", stories: { create: slots } },
    select: { id: true },
  });
  console.log(`JOURNEY_ID=${j.id} con ${slots.length} slots`);
}

main()
  .catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
