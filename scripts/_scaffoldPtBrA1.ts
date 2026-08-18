/**
 * Monta el Traveler PT-BR A1: 7 destinos x 3 historias = 21 slots.
 *
 * Tipo `traveler`, como el A0 que continúa. Por el plan de journeys, en Traveler
 * los siete temas son DESTINOS y el journey lleva 2 personajes fijos.
 *
 * El slug del tema es el destino y la etiqueta nombra el vocabulario, que es el
 * patrón del catálogo (barcelona -> "Beach & Shopping", madrid -> "Arriving &
 * Getting Around"): un nombre de ciudad no le dice nada a un anglosajón, así
 * que la etiqueta tiene que predecir el campo léxico. Por eso NO se le pasa
 * `slug` al portón de evidencia: su comprobación exige que el slug derive de la
 * etiqueta, y en un journey de destinos eso no aplica.
 *
 *   npx tsx scripts/_scaffoldPtBrA1.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";
import { assertJourneyType } from "../src/lib/journeyType";

const prisma = new PrismaClient();

const TEMAS: Array<{ slug: string; label: string; evidence: string[] }> = [
  { slug: "manaus",         label: "River & Rainforest",    evidence: ["travel"] },
  { slug: "florianopolis",  label: "Surf & Dunes",          evidence: ["travel"] },
  { slug: "foz-do-iguacu",  label: "Waterfalls & Borders",  evidence: ["travel"] },
  { slug: "olinda",         label: "Carnival & Old Town",   evidence: ["travel"] },
  { slug: "belem",          label: "Amazon Food & Markets", evidence: ["travel"] },
  { slug: "pantanal",       label: "Wildlife & Boats",      evidence: ["travel"] },
  { slug: "ouro-preto",     label: "Mines & Baroque Towns", evidence: ["travel"] },
];

async function main() {
  const dry = process.argv.includes("--dry");

  const existentes = (await prisma.journey.findMany({
    where: { language: "portuguese" }, select: { topics: true },
  })).flatMap((j) => j.topics);
  const labelsPrevias = (await prisma.topic.findMany({
    where: { slug: { in: existentes } }, select: { label: true },
  })).map((t) => t.label);

  await assertTopicsGrounded({
    language: "Portuguese",
    proposals: TEMAS.map((t) => ({ label: t.label, evidence: t.evidence })),
    existingLabels: labelsPrevias,
    prisma,
  });

  const typeSlug = await assertJourneyType({ typeSlug: "traveler", name: "Traveler", prisma });

  // Choques: un slug ya usado con OTRA etiqueta, o una etiqueta ya usada por
  // otro slug. La regla es un slug = una etiqueta, global.
  const conflictos: string[] = [];
  for (const t of TEMAS) {
    const porSlug = await prisma.topic.findFirst({ where: { slug: t.slug }, select: { label: true } });
    if (porSlug && porSlug.label !== t.label) conflictos.push(`${t.slug} ya es "${porSlug.label}"`);
    const porLabel = await prisma.topic.findFirst({ where: { label: t.label }, select: { slug: true } });
    if (porLabel && porLabel.slug !== t.slug) conflictos.push(`"${t.label}" ya lo usa ${porLabel.slug}`);
  }
  if (conflictos.length) throw new Error(`CHOQUE DE TEMAS:\n  - ${conflictos.join("\n  - ")}`);

  console.log(`tipo: ${typeSlug} · 7 temas · 21 historias`);
  if (dry) { console.log("[--dry] nada escrito."); return; }

  for (const t of TEMAS) {
    await prisma.topic.upsert({
      where: { slug: t.slug },
      update: { label: t.label },
      create: { slug: t.slug, label: t.label, isUniversal: false },
    });
  }

  const slots = TEMAS.flatMap((t) =>
    [0, 1, 2].map((i) => ({ level: "a1", topic: t.slug, slotIndex: i, status: "draft" as const })));

  const j = await prisma.journey.create({
    data: {
      name: "Traveler", language: "portuguese", variant: "brazil",
      typeSlug, levels: ["a1"], topics: TEMAS.map((t) => t.slug),
      storiesPerTopic: 3, status: "draft",
      stories: { create: slots },
    },
    select: { id: true, name: true, typeSlug: true },
  });
  console.log(`journey creado: ${j.id} (${j.name}, ${j.typeSlug}) con ${slots.length} slots`);
}

main()
  .catch((e) => { console.error("FALLÓ:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
