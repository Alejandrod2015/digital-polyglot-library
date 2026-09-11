/**
 * Monta el Friends FR A0: 7 temas x 3 historias = 21 slots, en draft.
 *
 * Tipo `relationships` (etiqueta "Friends"): un solo lugar, 2 fijos, temas =
 * momentos de la amistad, orden libre. Lugar: una placita de Le Panier,
 * Marseille, con el cafe de Lea y una pista de petanque delante. Fijos: Lea,
 * 29, lleva el cafe; Hugo, 32, su amigo de siempre, vive encima. Espina: en la
 * historia 1 Hugo dice que se va a Paris en seis meses; el journey son esos
 * seis meses. Decidido con el usuario en la ronda de /grill del 2026-09-11.
 *
 * LA EVIDENCIA. De 4 solicitantes de frances solo dos escribieron sobre su
 * vida: Kelly (se muda en 6-8 meses) y Whitley (le cuesta sentirse segura
 * entendiendo). Las otras dos escribieron sobre la app. Modo journey-level:
 * las dos citas sostienen el journey entero, y los temas son sus dominios
 * (irse y quedarse; entender y malentender).
 *
 *   npx tsx scripts/_scaffoldFriendsFrA0.ts [--dry]
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
  "still struggle feeling confident with my comprehension",
];

/**
 * Etiquetas anchas a proposito: en A0 el alumno recorre, no elige, y el
 * usuario rechazo el primer set por demasiado especifico (2026-09-11).
 *
 *   el ritual de la placita, y el anuncio   -> sports-and-games
 *   el mensaje que no se entiende           -> talking-and-listening
 *   lo que se presta antes de irse          -> helping-and-favours
 *   la broma que el otro no pilla           -> words-and-meanings
 *   el ultimo cumpleanos en Marseille       -> parties-and-gifts
 *   el piso de arriba, quien se lo queda    -> houses-and-neighbours
 *   la despedida y la vuelta                -> travel-and-goodbyes
 */
const TEMAS: Array<{ slug: string; label: string }> = [
  { slug: "sports-and-games",      label: "Sports & Games" },
  { slug: "talking-and-listening", label: "Talking & Listening" },
  { slug: "helping-and-favours",   label: "Helping & Favours" },
  { slug: "words-and-meanings",    label: "Words & Meanings" },
  { slug: "parties-and-gifts",     label: "Parties & Gifts" },
  { slug: "houses-and-neighbours", label: "Houses & Neighbours" },
  { slug: "travel-and-goodbyes",   label: "Travel & Goodbyes" },
];

const NUEVO = { name: "Friends", language: "french", variant: "france", levels: ["a0"] };

async function main() {
  const dry = process.argv.includes("--dry");

  const yaHay = await prisma.journey.findFirst({
    where: { language: "french", variant: "france", typeSlug: "relationships", status: { not: "archived" } },
    select: { id: true, status: true, levels: true },
  });

  const existentes = await prisma.journey.findMany({
    select: { name: true, language: true, variant: true, levels: true, status: true, topics: true },
  });
  assertLadderContiguous(NUEVO, existentes);

  const temasFr = existentes.filter((j) => j.language === "french" && j.status !== "archived").flatMap((j) => j.topics);
  const labelsPrevias = (await prisma.topic.findMany({
    where: { slug: { in: temasFr } }, select: { label: true },
  })).map((t) => t.label);

  await assertTopicsGrounded({
    language: "French",
    proposals: TEMAS.map((t) => ({ label: t.label, slug: t.slug })),
    journeyEvidence: CITAS_DEL_JOURNEY,
    existingLabels: labelsPrevias,
    prisma,
  });

  const typeSlug = await assertJourneyType({ typeSlug: "relationships", name: "Friends", prisma });

  const otrosJourneys = await prisma.journey.findMany({
    where: yaHay ? { id: { not: yaHay.id } } : {},
    select: { topics: true },
  });
  const slugsDeOtros = new Set(otrosJourneys.flatMap((j) => j.topics));
  const conflictos: string[] = [];
  for (const t of TEMAS) {
    const porSlug = await prisma.topic.findFirst({ where: { slug: t.slug }, select: { label: true } });
    if (porSlug && porSlug.label !== t.label && slugsDeOtros.has(t.slug))
      conflictos.push(`${t.slug} ya es "${porSlug.label}" y lo usa otro journey`);
    const porLabel = await prisma.topic.findFirst({ where: { label: t.label }, select: { slug: true } });
    if (porLabel && porLabel.slug !== t.slug) conflictos.push(`"${t.label}" ya lo usa ${porLabel.slug}`);
  }
  if (conflictos.length) throw new Error(`CHOQUE DE TEMAS:\n  - ${conflictos.join("\n  - ")}`);

  console.log(`tipo: ${typeSlug} · 7 temas · 21 historias · nivel a0 · draft`);
  if (yaHay) { console.log(`ya existe ${yaHay.id} (${yaHay.status}); no se crea otro.`); return; }
  if (dry) { console.log("[--dry] nada escrito."); return; }

  for (const t of TEMAS) {
    await prisma.topic.upsert({
      where: { slug: t.slug },
      update: { label: t.label },
      create: { slug: t.slug, label: t.label, isUniversal: false },
    });
  }

  const slots = TEMAS.flatMap((t) =>
    [0, 1, 2].map((i) => ({ level: "a0", topic: t.slug, slotIndex: i, status: "draft" as const })));

  const j = await prisma.journey.create({
    data: {
      name: NUEVO.name, language: NUEVO.language, variant: NUEVO.variant,
      typeSlug, levels: NUEVO.levels, topics: TEMAS.map((t) => t.slug),
      storiesPerTopic: 3, status: "draft",
      stories: { create: slots },
    },
    select: { id: true, name: true, typeSlug: true },
  });
  console.log(`journey creado: ${j.id} (${j.name}, ${j.typeSlug}) con ${slots.length} slots`);
}

main()
  .catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
