/**
 * Renombra los siete temas del Friends ES/Spain A1 para que cumplan la regla de
 * nombres (`project_topic_naming_rule`): el nombre nombra el DOMINIO LÉXICO de
 * sus tres historias, en inglés, con ampersand, sin país y sin artículo.
 *
 * Los que había fallaban así:
 *   Neighbours          -> nombra a las personas, no el campo de palabras
 *   The Local Bar       -> un sitio, y con artículo, que no usa ningún otro
 *   Shopping for Food   -> "for" en minúscula rompe el Title Case de la casa
 *   Spanish Hours       -> lleva el país, que la regla prohíbe expresamente
 *   Around the House    -> un sitio, con artículo
 *   Chemist & Doctor    -> promete un médico que no sale en ninguna historia
 *   Village Fiesta      -> en singular, y no dice qué se aprende
 *
 * Cambia también el SLUG, no solo el label, porque el lector cae a
 * `prettifyTopicLabel(slug)` durante la hora que tarda en refrescarse la caché
 * de `getTopicLabelBySlug`, y ahí se vería el nombre viejo (`project_topic_labels_mechanics`).
 *
 * Solo toca `JourneyStory.topic` y la tabla de temas: NO escribe contenido de
 * historia (ni texto ni vocab), así que no pasa por el portón de saveStory.
 *
 *   npx tsx scripts/_renameA1Topics.ts [--apply]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded, type TopicProposal } from "../src/lib/topicEvidence";

const prisma = new PrismaClient();
const JOURNEY_ID = "cmsvz6mz9000732gsgsfer0ko";

/**
 * La cita verbatim que justifica cada tema. `assertTopicsGrounded` las busca
 * LITERALMENTE en `BetaSignup`, así que inventar una hace fallar el gate.
 */
const EVIDENCE: Record<string, string[]> = {
  "Neighbours & Favours": ["Holiday home in Spain and I wish to talk to neighbours"],
  "Bars & Tapas": ["Travel", "Just for fun"],
  "Plans & Invitations": ["Just for fun", "A more fun and interactive method of learning a new language"],
  "Timetables & Meal Times": ["Travel", "Will be interesting to learn in an app which looks enjoyable"],
  "Family & Relatives": ["Family connection", "Improve my basic language and make my brain work"],
  "Health & Symptoms": ["Travel", "I want to see how this will help me learn to speak Spanish"],
  "Festivals & Traditions": ["Just for fun", "Travel"],
};


// Segunda pasada (2026-08-17). La primera arregló el ampersand y el país pero
// dejó cuatro nombres que siguen nombrando el SITIO o la ACCIÓN en vez del
// campo de palabras, que es la regla 1. `Chemist & Symptoms` era el peor:
// nombra una tienda, y el equivalente de la casa es `Health & Emergencies`.
// Cuarta pasada (2026-08-17): "Fiestas & Traditions" mezclaba idiomas sin
// motivo, porque "fiesta" tiene traducción exacta. "Tapas" NO: está en el
// diccionario inglés y no hay palabra equivalente, así que se queda. La regla
// no es "nada que suene español", es "nada que el lector no conozca ya o que
// tenga un equivalente llano en inglés".
// Tercera pasada (2026-08-17). Las dos anteriores arreglaron la FORMA del
// nombre; esta arregla la ELECCIÓN. `Shops & Markets` repetía "Beach &
// Shopping" y "Markets & The Sea" del A0, y `Home & Repairs` solo lo pedían
// dos de veintitrés y traía de vuelta el marco Expat que el brief había
// echado. Salen, y entran dos que sí sostienen los datos.
const MAP: Array<{ from: string; to: string; label: string }> = [
  // ORDEN = FASES DE INSTALACIÓN (2026-08-17). El journey pasa a tipo Expat,
  // que en el plan es mudanza interna dentro del propio país: una madrileña que
  // se instala en un pueblo de Málaga. El eje deja de ser "dominios sueltos" y
  // pasa a ser el orden en que te instalas: llegar y conocer al vecindario,
  // aprender el horario, entrar en el bar, situar quién es quién, empezar a
  // quedar, resolver un apuro, y por fin aportar en la fiesta.
  { from: "neighbours-and-favours",     to: "neighbours-and-favours",     label: "Neighbours & Favours" },
  { from: "timetables-and-meal-times",  to: "timetables-and-meal-times",  label: "Timetables & Meal Times" },
  { from: "bars-and-tapas",             to: "bars-and-tapas",             label: "Bars & Tapas" },
  { from: "family-and-relatives",       to: "family-and-relatives",       label: "Family & Relatives" },
  { from: "plans-and-invitations",      to: "plans-and-invitations",      label: "Plans & Invitations" },
  { from: "health-and-symptoms",        to: "health-and-symptoms",        label: "Health & Symptoms" },
  { from: "festivals-and-traditions",   to: "festivals-and-traditions",   label: "Festivals & Traditions" },
];

void (async () => {
  const apply = process.argv.includes("--apply");

  // PORTÓN: sin evidencia de usuario detrás de cada tema, esto tira y no se
  // escribe nada. El hook `.claude/safety/pre-topic-guard.sh` impide además
  // ejecutar cualquier script de temas que no llame a esta función.
  const proposals: TopicProposal[] = MAP.map((m) => ({ label: m.label, slug: m.to, evidence: EVIDENCE[m.label] ?? [] }));
  await assertTopicsGrounded({
    language: "spanish", proposals, prisma,
    existingLabels: ["Meeting Friends", "Visiting People", "Going For A Walk", "Arriving & Getting Around",
                     "Beach & Shopping", "Streets & Cafés", "Markets & The Sea"],
  });
  console.log("portón de evidencia: OK\n");

  // Solo son colisión los slugs de destino que YA existen y no vienen de este
  // mismo journey; volver a correr el script con un tema sin cambios no lo es.
  const mine = new Set(MAP.map((m) => m.from));
  const clash = (await prisma.topic.findMany({
    where: { slug: { in: MAP.map((m) => m.to) } },
    select: { slug: true },
  })).filter((c) => !mine.has(c.slug));
  if (clash.length) {
    console.error("ABORTO: esos slugs ya existen globalmente:", clash.map((c) => c.slug).join(", "));
    process.exit(1);
  }

  for (const [i, { from, to, label }] of MAP.entries()) {
    const n = await prisma.journeyStory.count({ where: { journeyId: JOURNEY_ID, topic: from } });
    console.log(`${from}${from === to ? " (sin cambio)" : ` -> ${to}`}   "${label}"   (${n} historias)`);
    if (!apply) continue;
    if (from !== to) {
      await prisma.journeyStory.updateMany({ where: { journeyId: JOURNEY_ID, topic: from }, data: { topic: to } });
    }
    await prisma.topic.upsert({
      where: { slug: to },
      update: { label, isUniversal: false, sortOrder: i },
      create: { slug: to, label, isUniversal: false, sortOrder: i },
    });
    if (from !== to) await prisma.topic.deleteMany({ where: { slug: from } });
  }

  if (apply) {
    // La caché de labels dura una hora y sobrevive a reiniciar el servidor,
    // así que se purga aquí y no de memoria.
    await fetch("http://localhost:3000/api/topics/revalidate", { method: "POST" })
      .then(() => console.log("\ncaché de etiquetas purgada"))
      .catch(() => console.log("\n(no hay dev server; purga la caché al levantarlo)"));
  }
  console.log(apply ? "APLICADO." : "\nsimulación: nada escrito. Repite con --apply.");
  await prisma.$disconnect();
})();
