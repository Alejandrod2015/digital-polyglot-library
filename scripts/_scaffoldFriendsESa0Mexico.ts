/**
 * Monta el Friends ES mexico A0 (Guadalajara): 7 temas x 3 historias = 21 slots, en draft.
 * Encargo de Journey-planning-2, 2026-09-22: 19 de las 118 solicitudes de la beta
 * piden espanol de Mexico y esa variante no tiene ni una historia de tipo Friends;
 * el espanol tampoco tiene ningun Friends A0 en ninguna variante.
 *
 * Tipo `relationships`, nombre "Friends". Cohorte `domains-2026-09`: el Friends ES
 * mexico C1 (cmrrrpru1000032nnzsmraa7h) es del molde viejo de siete ciudades y por
 * eso no sostiene peldano (src/lib/journeyLadder.ts).
 *
 * Los siete temas eligen campos lexicos que el pool latam NO ha gastado: mercados,
 * comida, fiestas, vecinos, arreglos, esperas y transporte estan todos tomados.
 * Las citas son PISTA, no filtro (2026-09-15).
 *
 *   npx tsx scripts/_scaffoldFriendsESa0Mexico.ts [--dry]
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
  "Living in Mexico, I'd like to be able to talk to my neighbors",
  "I study Spanish at home, but I have a hard time speaking fluently with other adults",
];

const TEMAS: Array<{ slug: string; label: string }> = [
  { slug: "rooftops-and-laundry", label: "Rooftops & Laundry" },
  { slug: "haircuts-and-barbershops", label: "Haircuts & Barbershops" },
  { slug: "plants-and-balconies", label: "Plants & Balconies" },
  { slug: "lost-and-found", label: "Lost & Found" },
  { slug: "wrestling-and-masks", label: "Wrestling & Masks" },
  { slug: "grills-and-backyards", label: "Grills & Backyards" },
  { slug: "parcels-and-deliveries", label: "Parcels & Deliveries" },
];

async function main() {
  const dry = process.argv.includes("--dry");
  const NUEVO = {
    name: "Friends", language: "spanish", variant: "mexico", levels: ["a0"],
    generationCohort: null as string | null,
  };

  const yaHay = await prisma.journey.findFirst({
    where: { language: "spanish", variant: "mexico", name: "Friends", levels: { has: "a0" }, status: { not: "archived" } },
    select: { id: true },
  });
  if (yaHay) throw new Error(`ya existe el Friends ES mexico A0: ${yaHay.id}`);

  const todos = await prisma.journey.findMany({
    select: {
      id: true, name: true, language: true, variant: true, levels: true, status: true,
      topics: true, generationCohort: true,
    },
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

  // Un slug = un label, globalmente. Que la fila ya exista NO es un choque
  // mientras diga lo mismo: `plants-and-balconies` lo estrenó el Friends PT
  // brazil A1 y es el mismo dominio con el mismo nombre. Otro idioma, otro
  // pool de vocabulario, ningún alumno ve los dos. Choque es que el slug
  // signifique otra cosa, o que el nombre ya lo lleve otro slug.
  const conflictos: string[] = [];
  const yaExisten: string[] = [];
  for (const t of TEMAS) {
    const porSlug = await prisma.topic.findFirst({ where: { slug: t.slug }, select: { label: true } });
    if (porSlug && porSlug.label !== t.label) conflictos.push(`${t.slug} ya existe como "${porSlug.label}"`);
    if (porSlug && porSlug.label === t.label) yaExisten.push(t.slug);
    const porLabel = await prisma.topic.findFirst({ where: { label: t.label }, select: { slug: true } });
    if (porLabel && porLabel.slug !== t.slug) conflictos.push(`"${t.label}" ya lo usa ${porLabel.slug}`);
  }
  if (conflictos.length) throw new Error(`CHOQUE DE TEMAS:\n  - ${conflictos.join("\n  - ")}`);
  if (yaExisten.length) console.log(`temas que ya tienen fila y se reusan: ${yaExisten.join(", ")}`);

  console.log(`tipo: ${typeSlug} · 7 temas · 21 historias · nivel a0 · draft · Guadalajara`);
  if (dry) { console.log("[--dry] nada escrito."); return; }

  for (const t of TEMAS) {
    if (yaExisten.includes(t.slug)) continue;
    await prisma.topic.create({ data: { slug: t.slug, label: t.label, isUniversal: false } });
  }
  const slots = TEMAS.flatMap((t) => [0, 1, 2].map((i) => ({ level: "a0", topic: t.slug, slotIndex: i, status: "draft" as const })));
  const j = await prisma.journey.create({
    data: {
      name: NUEVO.name, language: NUEVO.language, variant: NUEVO.variant, levels: NUEVO.levels,
      typeSlug, topics: TEMAS.map((t) => t.slug), storiesPerTopic: 3, status: "draft",
      stories: { create: slots },
    },
    select: { id: true },
  });
  console.log(`JOURNEY_ID=${j.id} con ${slots.length} slots`);
}

main()
  .catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
