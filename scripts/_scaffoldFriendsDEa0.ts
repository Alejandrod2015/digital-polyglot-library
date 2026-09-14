/**
 * Monta el Friends DE A0 (Bremen): 7 temas x 3 historias = 21 slots, en draft.
 * Plan aprobado: docs/plan-de-a0-friends.md (2026-09-13).
 *
 * Tipo `relationships`, nombre "Friends". Las citas sostienen el journey entero
 * (modo journey-level): en aleman solo dos personas escribieron sobre su vida.
 * El Friends DE C1 live no cuenta para la escalera (FUERA_DE_ESCALERA, test del
 * usuario), asi que este A0 abre la escalera real.
 *
 *   npx tsx scripts/_scaffoldFriendsDEa0.ts [--dry]
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
  "Now I would like to reconnect with my friends",
  "I made a lot of German friends",
  "to be able to read and possibly correspond in German",
];

const TEMAS: Array<{ slug: string; label: string }> = [
  { slug: "postcards-and-stamps", label: "Postcards & Stamps" },
  { slug: "photos-and-faces", label: "Photos & Faces" },
  { slug: "board-games-and-dice", label: "Board Games & Dice" },
  { slug: "books-and-newspapers", label: "Books & Newspapers" },
  { slug: "songs-and-instruments", label: "Songs & Instruments" },
  { slug: "pots-and-spoons", label: "Pots & Spoons" },
  { slug: "notes-and-magnets", label: "Notes & Magnets" },
];

async function main() {
  const dry = process.argv.includes("--dry");
  const NUEVO = { name: "Friends", language: "german", variant: "germany", levels: ["a0"] };

  const yaHay = await prisma.journey.findFirst({
    where: { language: "german", variant: "germany", name: "Friends", levels: { has: "a0" }, status: { not: "archived" } },
    select: { id: true },
  });
  if (yaHay) throw new Error(`ya existe el Friends DE A0: ${yaHay.id}`);

  const todos = await prisma.journey.findMany({
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true, topics: true },
  });
  assertLadderContiguous(NUEVO, todos);

  const aleman = todos.filter((j) => j.language === "german").flatMap((j) => j.topics);
  const labelsPrevias = (await prisma.topic.findMany({ where: { slug: { in: aleman } }, select: { label: true } })).map((t) => t.label);
  await assertTopicsGrounded({
    language: "German",
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

  console.log(`tipo: ${typeSlug} · 7 temas · 21 historias · nivel a0 · draft`);
  if (dry) { console.log("[--dry] nada escrito."); return; }

  for (const t of TEMAS) {
    await prisma.topic.create({ data: { slug: t.slug, label: t.label, isUniversal: false } });
  }
  const slots = TEMAS.flatMap((t) => [0, 1, 2].map((i) => ({ level: "a0", topic: t.slug, slotIndex: i, status: "draft" as const })));
  const j = await prisma.journey.create({
    data: { ...NUEVO, typeSlug, topics: TEMAS.map((t) => t.slug), storiesPerTopic: 3, status: "draft", stories: { create: slots } },
    select: { id: true },
  });
  console.log(`JOURNEY_ID=${j.id} con ${slots.length} slots`);
}

main()
  .catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
