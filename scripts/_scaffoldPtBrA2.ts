/**
 * Monta el Traveler PT-BR A2: 7 destinos x 3 historias = 21 slots, en draft.
 *
 * RELLENA EL PELDANO QUE FALTA. El B1 se abrio con el A2 sin existir y la
 * escalera del tipo quedo a0, a1, hueco, b1; por eso este journey pasa
 * `assertLadderContiguous` (src/lib/journeyLadder.ts) y por eso el B1 no puede
 * crecer hacia arriba hasta que este exista.
 *
 * LA ESPINA. De los 9 solicitantes de portugues solo dos escribieron sobre su
 * vida: Alison ("dating a Brazilian", "dividing my year between Brazil and
 * England") y Jean-Pierre ("Have day to day conversations"). El B1 tomo el
 * lado de Alison: alguien que VUELVE y todavia no vive alli. El A2 toma el de
 * Jean-Pierre, que es el peldano anterior: la viajera que deja de mirar y
 * empieza a RESOLVER, y cada parada le pide una conversacion corriente que en
 * el A1 hacia otra persona por ella. No es un A1 mas largo ni un B1 mas facil:
 * es el tramo donde hablar deja de ser opcional.
 *
 * Los siete temas son los DOMINIOS de esa cita, no siete postales; el slug es
 * el destino, que es la estructura del tipo Traveler, y la etiqueta nombra el
 * campo lexico, que es el patron del catalogo. Al porton de evidencia NO se le
 * pasa `slug` a proposito: su comprobacion exige que el slug derive de la
 * etiqueta, y aqui el slug es el destino.
 *
 *   npx tsx scripts/_scaffoldPtBrA2.ts [--dry]
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

/** Modo journey-level: las unicas dos personas de portugues que escribieron
 *  sobre su vida. Se declara la escasez en vez de repartirla en siete citas. */
const CITAS_DEL_JOURNEY = [A, D, C];

/**
 *   la clase que empieza sin material      -> salvador
 *   el cuerpo que avisa                    -> recife
 *   la casa compartida y su turno          -> jericoacoara
 *   el plan que se moja                    -> lencois-maranhenses
 *   la noche que se pasa viajando          -> campo-grande
 *   lo que se manda y no llega             -> petropolis
 *   el frio que nadie le habia dicho       -> gramado
 */
const TEMAS: Array<{ slug: string; label: string }> = [
  { slug: "salvador",             label: "Classrooms & Exams" },
  { slug: "recife",               label: "Pharmacy & Small Aches" },
  { slug: "jericoacoara",         label: "Kitchens & Chores" },
  { slug: "lencois-maranhenses",  label: "Storms & Changed Plans" },
  { slug: "campo-grande",         label: "Buses & Night Rides" },
  { slug: "petropolis",           label: "Post & Parcels" },
  { slug: "gramado",              label: "Laundry & Cold Nights" },
];

async function main() {
  const dry = process.argv.includes("--dry");

  const yaHay = await prisma.journey.findFirst({
    where: { language: "portuguese", variant: "brazil", levels: { has: "a2" }, status: { not: "archived" } },
    select: { id: true, status: true },
  });

  const existentes = (await prisma.journey.findMany({
    where: { language: "portuguese" }, select: { topics: true },
  })).flatMap((j) => j.topics);
  const labelsPrevias = (await prisma.topic.findMany({
    where: { slug: { in: existentes } }, select: { label: true },
  })).map((t) => t.label);

  await assertTopicsGrounded({
    language: "Portuguese",
    proposals: TEMAS.map((t) => ({ label: t.label })),
    journeyEvidence: CITAS_DEL_JOURNEY,
    existingLabels: labelsPrevias,
    prisma,
  });

  const typeSlug = await assertJourneyType({ typeSlug: "traveler", name: "Traveler", prisma });

  // EL PORTON DE LA ESCALERA. Va antes de journey.create y con el catalogo
  // live+draft delante: el a2 cierra el hueco entre el a1 y el b1.
  const paraEscalera = (await prisma.journey.findMany({
    where: { status: { not: "archived" } },
    select: { name: true, language: true, variant: true, levels: true, status: true },
  })).map((j) => ({
    name: j.name, language: j.language, variant: j.variant ?? "",
    levels: j.levels ?? [], status: j.status,
  }));
  assertLadderContiguous(
    { name: "Traveler", language: "portuguese", variant: "brazil", levels: ["a2"] },
    paraEscalera,
  );
  console.log("escalera: contigua con el a2 dentro (a0, a1, a2, b1).");

  // Un slug = una etiqueta, global.
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

  console.log(`tipo: ${typeSlug} · 7 temas · 21 historias · nivel a2 · draft`);
  if (dry) { console.log("[--dry] nada escrito."); return; }

  for (const t of TEMAS) {
    await prisma.topic.upsert({
      where: { slug: t.slug },
      update: { label: t.label },
      create: { slug: t.slug, label: t.label, isUniversal: false },
    });
  }

  if (yaHay) {
    await prisma.journey.update({
      where: { id: yaHay.id },
      data: { topics: TEMAS.map((t) => t.slug) },
    });
    console.log(`journey ${yaHay.id} ya existia: etiquetas y orden de temas actualizados, slots intactos.`);
    return;
  }

  const slots = TEMAS.flatMap((t) =>
    [0, 1, 2].map((i) => ({ level: "a2", topic: t.slug, slotIndex: i, status: "draft" as const })));

  const j = await prisma.journey.create({
    data: {
      name: "Traveler", language: "portuguese", variant: "brazil",
      typeSlug, levels: ["a2"], topics: TEMAS.map((t) => t.slug),
      storiesPerTopic: 3, status: "draft",
      stories: { create: slots },
    },
    select: { id: true, name: true, typeSlug: true },
  });
  console.log(`journey creado: ${j.id} (${j.name}, ${j.typeSlug}) con ${slots.length} slots`);
  console.log("El puntero nextJourneyId del A1 NO se toca: apuntar un journey vivo a un draft mandaria lectores a lo que no existe. Se enlaza al publicar.");
}

main()
  .catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
