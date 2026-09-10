/**
 * Monta el Traveler PT-BR A0 nuevo: 7 destinos x 3 historias = 21 slots, en draft.
 *
 * POR QUE (decision del usuario, 2026-09-10): el A0 publicado media como un A1
 * (mediana de 10 palabras por frase contra 6 de un A0 real, 4,46 sil/s de
 * audio) y los cuatro Traveler brasilenos subieron un peldano
 * (scripts/_subeNivelPtTraveler.ts). Debajo queda el hueco de un A0 de verdad:
 * una idea por frase, solo presente, dialogo breve, mini arco con giro.
 *
 * Encadena HACIA el antiguo A0, hoy A1 (cmsou2uk0000732mqa4oatcmn). Apuntar un
 * draft a un journey vivo no manda a nadie a lo que no existe, al reves que el
 * caso del B1.
 *
 * Al porton de evidencia NO se le pasa `slug`, igual que en el B1: en un
 * journey de destinos el slug es el destino y la etiqueta nombra el campo
 * lexico. Las citas son las mismas que sostienen el B1, porque siguen siendo
 * las unicas de portugues que hablan de una vida y no de la app: alguien con
 * pareja brasilena que va a partir el ano entre Brasil e Inglaterra, y quiere
 * conversar a diario. En A0 eso son los primeros campos de ese ano: saludar,
 * la familia del otro, el desayuno, los dias, el tiempo, la casa, el telefono.
 *
 *   npx tsx scripts/_scaffoldPtBrA0.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";
import { assertJourneyType } from "../src/lib/journeyType";
import { assertLadderContiguous } from "../src/lib/journeyLadder";

const prisma = new PrismaClient();

const A = "dividing my year between Brazil and England";
const D = "dating a Brazilian";
const C = "Have day to day conversations";
const CITAS_DEL_JOURNEY = [A, D, C];

const SIGUIENTE = "cmsou2uk0000732mqa4oatcmn"; // Traveler PT-BR A1 (el antiguo A0)

const TEMAS: Array<{ slug: string; label: string }> = [
  { slug: "rio-de-janeiro", label: "Greetings & Names" },
  { slug: "belo-horizonte", label: "Family & Photos" },
  { slug: "fortaleza",      label: "Coffee & Breakfast" },
  { slug: "porto-alegre",   label: "Days & Plans" },
  { slug: "natal",          label: "Weather & Clothes" },
  { slug: "sao-luis",       label: "Doors & Keys" },
  { slug: "bonito",         label: "Phones & Numbers" },
];

async function main() {
  const dry = process.argv.includes("--dry");
  const NUEVO = { name: "Traveler", language: "portuguese", variant: "brazil", levels: ["a0"] };

  const yaHay = await prisma.journey.findFirst({
    where: { language: "portuguese", variant: "brazil", name: "Traveler", levels: { has: "a0" }, status: { not: "archived" } },
    select: { id: true },
  });
  if (yaHay) throw new Error(`ya existe un Traveler PT-BR a0 (${yaHay.id}); no se crea otro`);

  const existentes = await prisma.journey.findMany({
    select: { name: true, language: true, variant: true, levels: true, status: true },
  });
  assertLadderContiguous(NUEVO, existentes);

  const siguiente = await prisma.journey.findUniqueOrThrow({ where: { id: SIGUIENTE }, select: { levels: true, status: true } });
  if (JSON.stringify(siguiente.levels) !== JSON.stringify(["a1"]))
    throw new Error(`el siguiente ${SIGUIENTE} deberia ser a1 y es ${JSON.stringify(siguiente.levels)}`);

  const labelsPrevias = (await prisma.topic.findMany({
    where: { slug: { in: (await prisma.journey.findMany({ where: { language: "portuguese" }, select: { topics: true } })).flatMap((j) => j.topics) } },
    select: { label: true },
  })).map((t) => t.label);

  await assertTopicsGrounded({
    language: "Portuguese",
    proposals: TEMAS.map((t) => ({ label: t.label })),
    journeyEvidence: CITAS_DEL_JOURNEY,
    existingLabels: labelsPrevias,
    prisma,
  });

  const typeSlug = await assertJourneyType({ typeSlug: "traveler", name: "Traveler", prisma });

  const conflictos: string[] = [];
  for (const t of TEMAS) {
    const porSlug = await prisma.topic.findFirst({ where: { slug: t.slug }, select: { label: true } });
    if (porSlug) conflictos.push(`el slug ${t.slug} ya existe como "${porSlug.label}"`);
    const porLabel = await prisma.topic.findFirst({ where: { label: { equals: t.label, mode: "insensitive" } }, select: { slug: true } });
    if (porLabel) conflictos.push(`"${t.label}" ya lo usa ${porLabel.slug}`);
  }
  if (conflictos.length) throw new Error(`CHOQUE DE TEMAS:\n  - ${conflictos.join("\n  - ")}`);

  console.log(`tipo: ${typeSlug} · 7 temas · 21 historias · nivel a0 · draft · siguiente ${SIGUIENTE} (${siguiente.status})`);
  console.log("escalera: contigua; evidencia: aceptada; temas: sin choques");
  if (dry) { console.log("[--dry] nada escrito."); return; }

  const slots = TEMAS.flatMap((t) =>
    [0, 1, 2].map((i) => ({ level: "a0", topic: t.slug, slotIndex: i, status: "draft" as const })));

  const j = await prisma.$transaction(async (tx) => {
    for (const t of TEMAS)
      await tx.topic.create({ data: { slug: t.slug, label: t.label, isUniversal: false } });
    return tx.journey.create({
      data: {
        ...NUEVO, typeSlug, topics: TEMAS.map((t) => t.slug),
        storiesPerTopic: 3, status: "draft", nextJourneyId: SIGUIENTE,
        stories: { create: slots },
      },
      select: { id: true },
    });
  });
  console.log(`journey creado: ${j.id} con ${slots.length} slots`);
}

main()
  .catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
