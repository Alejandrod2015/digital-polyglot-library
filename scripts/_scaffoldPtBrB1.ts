/**
 * Monta el Traveler PT-BR B1: 7 destinos x 3 historias = 21 slots, en draft.
 *
 * Encadena desde el Traveler PT-BR A1 publicado (cmsyrge55000732u9oiu8wue3).
 * Tipo `traveler`, como el A0 y el A1 de la misma escalera: por el plan de
 * journeys, en Traveler los siete temas son DESTINOS y el journey lleva 2
 * personajes fijos.
 *
 * Igual que en el scaffold del A1, al porton de evidencia NO se le pasa `slug`:
 * su comprobacion exige que el slug derive de la etiqueta, y en un journey de
 * destinos el slug es el destino y la etiqueta nombra el campo lexico, que es
 * el patron del catalogo (manaus -> "River & Rainforest").
 *
 * LA ESPINA, y de donde sale. De los 9 solicitantes de portugues solo dos
 * escribieron algo que hable de su vida: Alison ("dating a Brazilian",
 * "dividing my year between Brazil and England") y Jean-Pierre ("Have day to
 * day conversations"). Los otros siete escribieron sobre la app. Asi que el
 * journey no va de hacer turismo por siete sitios: va de alguien que VUELVE,
 * que ya no es turista y todavia no vive alli, y los destinos son las paradas
 * de ese ano partido en dos. Es lo unico que estas dos frases sostienen de
 * verdad, y esta escrito aqui para que nadie tenga que adivinarlo luego.
 *
 *   npx tsx scripts/_scaffoldPtBrB1.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";
import { assertJourneyType } from "../src/lib/journeyType";

const prisma = new PrismaClient();

const A = "dividing my year between Brazil and England";
const D = "dating a Brazilian";
const C = "Have day to day conversations";

/**
 * Las citas sostienen el JOURNEY entero, no un tema cada una: son las unicas
 * dos personas de portugues que escribieron sobre su vida. El porton lo acepta
 * en modo journey-level (aprobado el 2026-09-06) justamente para que esa
 * escasez se declare en vez de repartirse en siete citas de mentira.
 */
const CITAS_DEL_JOURNEY = [A, D, C];

/**
 * Los siete temas son los DOMINIOS de esas citas, no siete postales. El slug es
 * el destino, que es la estructura del tipo Traveler; la etiqueta nombra el
 * campo lexico, que es el patron del catalogo.
 *
 *   volver y no tener donde dormir      -> sao-paulo
 *   la conversacion de todos los dias   -> curitiba
 *   la familia del otro                 -> serra-gaucha
 *   lo que debes cuando vuelves siempre -> paraty
 *   su oficio, ahora que conoce el pais -> chapada-diamantina
 *   las reglas que se pagan             -> fernando-de-noronha
 *   el papeleo del ano partido en dos   -> brasilia
 */
const TEMAS: Array<{ slug: string; label: string }> = [
  { slug: "sao-paulo",           label: "Traffic & Rented Rooms" },
  { slug: "curitiba",            label: "Neighbours & Small Talk" },
  { slug: "serra-gaucha",        label: "Family Lunch & Invitations" },
  { slug: "paraty",              label: "Favours & Small Debts" },
  { slug: "chapada-diamantina",  label: "Trails & Guides" },
  { slug: "fernando-de-noronha", label: "Diving & Island Rules" },
  { slug: "brasilia",            label: "Offices & Appointments" },
];

async function main() {
  const dry = process.argv.includes("--dry");

  const yaHay = await prisma.journey.findFirst({
    where: { language: "portuguese", variant: "brazil", levels: { has: "b1" }, status: { not: "archived" } },
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

  // Un slug = una etiqueta, global. Renombrar la etiqueta de un slug SOLO se
  // permite si ningun otro journey lo usa: ahi no se le esta cambiando el
  // significado a nadie, se esta corrigiendo el propio.
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

  console.log(`tipo: ${typeSlug} · 7 temas · 21 historias · nivel b1 · draft`);
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
    [0, 1, 2].map((i) => ({ level: "b1", topic: t.slug, slotIndex: i, status: "draft" as const })));

  const j = await prisma.journey.create({
    data: {
      name: "Traveler", language: "portuguese", variant: "brazil",
      typeSlug, levels: ["b1"], topics: TEMAS.map((t) => t.slug),
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
