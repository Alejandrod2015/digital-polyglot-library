/**
 * Termina de montar el Conversations ES latam A0 (cmub5my8d000432ye0v6pv5ng),
 * el primer journey MULTIPERSONAJE: le faltan 5 de los 7 temas y las 21
 * casillas donde `saveStory` escribe.
 *
 * El journey se creo con dos temas y sin una sola fila de historia, asi que
 * `saveStory` validaba las tres historias del tema 1 en verde y despues decia
 * `NO slot for new-neighbors#0 (skipped)`: RELLENA casillas, no las crea. Esto
 * crea lo que falta y nada mas. No toca el journey ni los dos temas que ya
 * estan, y no escribe contenido: las 21 casillas nacen vacias y en draft.
 *
 * El slug de cada tema ya viaja en las 21 historias escritas y en los
 * `segments*.json` con los que se narro, asi que aqui el slug manda y el label
 * se elige para derivarlo: "Wifi & Passwords" y no "Wi-Fi & Passwords", que
 * daria "wi-fi-and-passwords".
 *
 * `slotIndex` va 0-1-2 porque asi lo traen los `tema*.json` que ya pasaron el
 * validador. El catalogo tiene las dos convenciones; la que importa es que
 * casille con lo que se va a guardar.
 *
 *   npx tsx scripts/_scaffoldConversationsEsA0.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";

const prisma = new PrismaClient();

const JOURNEY_ID = "cmub5my8d000432ye0v6pv5ng";

/** Los siete, EN ORDEN. Los dos primeros ya existen como fila `Topic`. */
const TEMAS: Array<{ slug: string; label: string }> = [
  { slug: "new-neighbors", label: "New Neighbors" },
  { slug: "home-and-neighbors", label: "Home & Neighbors" },
  { slug: "clothes-and-laundry", label: "Clothes & Laundry" },
  { slug: "packages-and-deliveries", label: "Packages & Deliveries" },
  { slug: "noise-and-sleep", label: "Noise & Sleep" },
  { slug: "wifi-and-passwords", label: "Wifi & Passwords" },
  { slug: "goodbyes-and-keys", label: "Goodbyes & Keys" },
];

async function main() {
  const dry = process.argv.includes("--dry");

  const j = await prisma.journey.findUnique({
    where: { id: JOURNEY_ID },
    select: { id: true, name: true, language: true, variant: true, levels: true, topics: true, status: true },
  });
  if (!j) throw new Error(`no existe el journey ${JOURNEY_ID}`);
  if (j.language !== "spanish" || j.variant !== "latam" || !j.levels.includes("a0"))
    throw new Error(`el journey ${JOURNEY_ID} no es el ES latam A0: ${j.language}/${j.variant}/${j.levels.join(",")}`);

  const filas = await prisma.topic.findMany({
    where: { slug: { in: TEMAS.map((t) => t.slug) } },
    select: { slug: true, label: true },
  });
  const faltan = TEMAS.filter((t) => !filas.some((f) => f.slug === t.slug));

  // Un slug que ya esta con OTRO label, o un label que ya usa otro slug, se
  // para aqui: un slug es un label global y una variante inventada rompe eso.
  const conflictos: string[] = [];
  for (const t of TEMAS) {
    const fila = filas.find((f) => f.slug === t.slug);
    if (fila && fila.label !== t.label) conflictos.push(`${t.slug} ya existe como "${fila.label}", no como "${t.label}"`);
    const porLabel = await prisma.topic.findFirst({ where: { label: t.label }, select: { slug: true } });
    if (porLabel && porLabel.slug !== t.slug) conflictos.push(`"${t.label}" ya lo usa ${porLabel.slug}`);
  }
  if (conflictos.length) throw new Error(`CHOQUE DE TEMAS:\n  - ${conflictos.join("\n  - ")}`);

  const otrosEs = (await prisma.journey.findMany({
    where: { language: "spanish", id: { not: JOURNEY_ID } },
    select: { topics: true },
  })).flatMap((x) => x.topics);
  const labelsPrevias = (await prisma.topic.findMany({
    where: { slug: { in: otrosEs } }, select: { label: true },
  })).map((t) => t.label);
  await assertTopicsGrounded({
    language: "Spanish",
    proposals: faltan.map((t) => ({ label: t.label, slug: t.slug })),
    existingLabels: labelsPrevias,
    prisma,
  });

  const casillas = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY_ID }, select: { topic: true, slotIndex: true },
  });
  const tiene = new Set(casillas.map((c) => `${c.topic}#${c.slotIndex}`));
  const nuevas = TEMAS.flatMap((t) => [0, 1, 2]
    .filter((i) => !tiene.has(`${t.slug}#${i}`))
    .map((i) => ({ journeyId: JOURNEY_ID, level: "a0", topic: t.slug, slotIndex: i, status: "draft" as const })));

  console.log(`journey ${j.name}/${j.language}/${j.variant} (${j.status})`);
  console.log(`temas: ${j.topics.length}/7 en el journey · filas Topic a crear: ${faltan.map((t) => t.slug).join(", ") || "ninguna"}`);
  console.log(`casillas: ${casillas.length} ya estan · ${nuevas.length} a crear`);
  if (dry) { console.log("[--dry] nada escrito."); return; }

  for (const t of faltan) await prisma.topic.create({ data: { slug: t.slug, label: t.label, isUniversal: false } });
  await prisma.journey.update({ where: { id: JOURNEY_ID }, data: { topics: TEMAS.map((t) => t.slug) } });
  if (nuevas.length) await prisma.journeyStory.createMany({ data: nuevas });

  const despues = await prisma.journeyStory.count({ where: { journeyId: JOURNEY_ID } });
  console.log(`LISTO: ${faltan.length} temas creados · topics=${TEMAS.length} · casillas=${despues}`);
}

main()
  .catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
