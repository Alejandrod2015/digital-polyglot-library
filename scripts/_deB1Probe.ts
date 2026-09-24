/** Sonda SIN ESCRITURA: nombres de los 7 temas del Friends DE B1 + informe de pistas. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { topicNameProblems, reportTopicEvidence, type TopicProposal } from "../src/lib/topicEvidence";
import { isCityApproved, approvedCitiesFor } from "../src/lib/approvedCities";

const TEMAS: Array<TopicProposal & { slug: string }> = [
  { label: "Beer Gardens & Regulars", slug: "beer-gardens-and-regulars" },
  { label: "Neighbours & House Rules", slug: "neighbours-and-house-rules" },
  { label: "Bikes & Breakdowns", slug: "bikes-and-breakdowns" },
  { label: "Trains & Delays", slug: "trains-and-delays" },
  { label: "Rehearsals & Stage Fright", slug: "rehearsals-and-stage-fright" },
  { label: "Deadlines & Favours", slug: "deadlines-and-favours" },
  { label: "Rivers & Summer Heat", slug: "rivers-and-summer-heat" },
];

(async () => {
  const p = new PrismaClient();
  console.log("--- reglas de NOMBRE (las que tiran) ---");
  const probs = topicNameProblems(TEMAS);
  console.log(probs.length ? probs.join("\n") : "sin problemas de nombre");

  const choque = await p.topic.findMany({ where: { slug: { in: TEMAS.map(t => t.slug) } } });
  console.log(`--- slugs ocupados: ${choque.length ? choque.map(c=>c.slug).join(", ") : "ninguno"}`);

  for (const c of ["Munich", "Berlin", "Hamburg", "Frankfurt"])
    console.log(`  ciudad ${c.padEnd(10)} aprobada=${isCityApproved("german", c)}`);
  console.log(`  aprobadas (german): ${approvedCitiesFor("german").join(" | ")}`);

  const rep = await reportTopicEvidence({ language: "German", proposals: TEMAS, prisma: p });
  console.log(`--- corpus aleman: ${rep.corpusSize} frases escritas (${rep.writtenMotivations} motivation + ${rep.applicationReasons} applicationReason), ${rep.cannedClicks} clics descartados`);
  for (const t of rep.topics) console.log(`  ${t.cited ? "cita" : "SIN pista"}  ${t.label}`);
  await p.$disconnect();
})();
