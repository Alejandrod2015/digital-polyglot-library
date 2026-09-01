/**
 * Reordena el array `topics` del Traveler spanish/latam A2 para que siga la ruta
 * lineal del brief (Rosario, Salento, Medellín, cruce del sur, Arequipa,
 * Guadalajara, Mérida). NO toca ninguna etiqueta ni ningún slug: el único write
 * es el array. Pasa por `assertTopicsGrounded` antes de escribir, como exige el
 * portón de temas, y vuelve a leer la base para verificar.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { assertTopicsGrounded, type TopicProposal } from "@/lib/topicEvidence";
import { PrismaClient } from "../src/generated/prisma";

const JOURNEY = "cmtgelq560007j84n3ujx9bpd";

/** Orden de la ruta. Las citas son las mismas que se aprobaron al crearlos. */
const ORDEN: TopicProposal[] = [
  { label: "Friends & Reunions", slug: "friends-and-reunions", evidence: [
      "I kept a lot of friends and strong links", "for my job and friends" ] },
  { label: "Staying With Locals", slug: "staying-with-locals", evidence: [
      "I wish to talk to neighbours", "from the real pepole living there point of view" ] },
  { label: "Jokes & Misunderstandings", slug: "jokes-and-misunderstandings", evidence: [
      "he never seems to translate the way I would translate myself", "understand and use slang" ] },
  { label: "Borders & Crossings", slug: "borders-and-crossings", evidence: [
      "want to try all the chances which are available", "I started to learn Spanish for my new girlfriend" ] },
  { label: "Secrets & Curiosity", slug: "secrets-and-curiosity", evidence: [
      "know peoples secrets", "seem to understand, reached for or fixed" ] },
  { label: "Work Trips & Meetings", slug: "work-trips-and-meetings", evidence: [
      "full business meetings", "enlarge my social, language and cultural skills" ] },
  { label: "Local Life & Routines", slug: "local-life-and-routines", evidence: [
      "I want to have my own conversations with her", "every time she need something" ] },
];

const p = new PrismaClient();
(async () => {
  const antes = await p.journey.findUnique({ where: { id: JOURNEY }, select: { topics: true, status: true } });
  if (!antes) throw new Error(`No existe el journey ${JOURNEY}`);
  console.log("ANTES:", antes.topics);

  // Válvula: los siete que se reordenan tienen que ser exactamente los que hay.
  const quiero = ORDEN.map((t) => t.slug!);
  if ([...antes.topics].sort().join("|") !== [...quiero].sort().join("|")) {
    throw new Error(`El array de la base no contiene los mismos siete slugs.\n  base:   ${antes.topics}\n  quiero: ${quiero}`);
  }

  const js = await p.journey.findMany({ where: { language: "spanish", status: { not: "archived" } }, select: { topics: true } });
  const tops = await p.topic.findMany({ where: { slug: { in: [...new Set(js.flatMap((j) => j.topics))] } }, select: { label: true } });
  await assertTopicsGrounded({ language: "spanish", proposals: ORDEN, existingLabels: tops.map((t) => t.label), prisma: p });

  await p.journey.update({ where: { id: JOURNEY }, data: { topics: quiero } });

  const despues = await p.journey.findUnique({ where: { id: JOURNEY }, select: { topics: true } });
  console.log("DESPUES:", despues!.topics);
  const ok = despues!.topics.join("|") === quiero.join("|");
  console.log(ok ? "VERIFICADO: el array releido coincide con el orden pedido." : "FALLO: el array releido NO coincide.");
  if (!ok) process.exit(1);
})().finally(() => p.$disconnect());
