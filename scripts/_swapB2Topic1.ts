/**
 * Cambia el tema 1 del Traveler ES/spain B2 recien creado: `accents-and-origins`
 * nacia atrapado, porque el gate de conjunto `journey-no-accent-mentions`
 * (validateJourneyStories.ts:532) prohibe la palabra "acento" en cualquier
 * cuerpo; un tema cuyo dominio lexico no puede nombrarse no se puede escribir.
 * `locals-and-outsiders` cubre la misma cita ("be taken as a native speaker")
 * por DATO (ser de fuera / de aqui), que es lo que la regla permite.
 *
 * La fila vieja se borra: se creo hace minutos en esta misma sesion, ningun
 * journey ni historia la referencia.
 */
import { config } from "dotenv"; config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";

const p = new PrismaClient();
const B2_ID = "cmtplpfum0007j8c6piegwt31";

(async () => {
  await assertTopicsGrounded({
    language: "Spanish",
    proposals: [{ label: "Locals & Outsiders", slug: "locals-and-outsiders",
      evidence: ["be taken as a native speaker"] }],
    prisma: p,
  });

  const usos = await p.journeyStory.count({ where: { topic: "accents-and-origins", NOT: { journeyId: B2_ID } } });
  const otros = await p.journey.count({ where: { topics: { has: "accents-and-origins" }, NOT: { id: B2_ID } } });
  if (usos || otros) throw new Error(`accents-and-origins tiene otros usos (${usos} historias, ${otros} journeys)`);

  await p.topic.create({ data: { slug: "locals-and-outsiders", label: "Locals & Outsiders", isUniversal: false } });
  const j = await p.journey.findUnique({ where: { id: B2_ID } });
  const topics = j!.topics.map((t) => (t === "accents-and-origins" ? "locals-and-outsiders" : t));
  await p.journey.update({ where: { id: B2_ID }, data: { topics } });
  await p.journeyStory.updateMany({ where: { journeyId: B2_ID, topic: "accents-and-origins" }, data: { topic: "locals-and-outsiders" } });
  await p.topic.delete({ where: { slug: "accents-and-origins" } });
  console.log("Temas finales:", topics.join(", "));
  await p.$disconnect();
})();
