import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded, TopicEvidenceError } from "../src/lib/topicEvidence";

// PILOTO (2026-08-23). Tres journeys A0 Traveler en los idiomas que pide la
// lista de espera. Se llama a `assertTopicsGrounded` para los tres: donde no
// hay evidencia, el fallo se IMPRIME y queda anotado como deuda, no se
// disfraza citando una frase generica en los siete temas.
const PLAN = [
  {
    language: "polish", variant: "poland",
    topics: ["trains-and-tickets","milk-bars-and-canteens","old-town-and-squares","markets-and-money","meeting-people","forest-and-lakes","snow-and-mountains"],
    labels: ["Trains & Tickets","Milk Bars & Canteens","Old Town & Squares","Markets & Money","Meeting People","Forest & Lakes","Snow & Mountains"],
    evidence: ["Avid language learner since childhood"],
  },
  {
    language: "korean", variant: "korea",
    topics: ["subway-and-transfers","street-food","palaces-and-gates","convenience-stores","meeting-people","mountains-and-temples","night-markets"],
    labels: ["Subway & Transfers","Street Food","Palaces & Gates","Convenience Stores","Meeting People","Mountains & Temples","Night Markets"],
    evidence: ["Because it sounds fun and would like to bring with me where ever i go"],
  },
  {
    language: "arabic", variant: "egypt",
    topics: ["river-and-ferries","street-food","old-city-and-gates","markets-and-money","meeting-people","tea-and-cafes","desert-and-oasis"],
    labels: ["River & Ferries","Street Food","Old City & Gates","Markets & Money","Meeting People","Tea & Cafes","Desert & Oasis"],
    evidence: ["General conversation as I travel thru North Africa"],
  },
];
const LANG_LABEL: Record<string,string> = { polish:"Polish", korean:"Korean", arabic:"Arabic" };

(async () => {
  const p = new PrismaClient();
  for (const j of PLAN) {
    const proposals = j.labels.map((label, i) => ({ label, slug: j.topics[i], evidence: j.evidence }));
    try {
      await assertTopicsGrounded({ language: LANG_LABEL[j.language], proposals, prisma: p });
      console.log(`PORTON OK  ${j.language}`);
    } catch (e) {
      console.log(`PORTON FALLA ${j.language} -> DEUDA ANOTADA:\n${e instanceof TopicEvidenceError ? e.message.split("\n")[0] : e}\n`);
    }
    const existing = await p.journey.findFirst({ where: { language: j.language, variant: j.variant, typeSlug: "traveler" } });
    if (existing) { console.log(`  ya existia: ${existing.id}`); continue; }
    const row = await p.journey.create({
      data: {
        name: "Traveler", language: j.language, variant: j.variant, typeSlug: "traveler",
        levels: ["a0"], topics: j.topics, storiesPerTopic: 3, status: "draft",
        createdBy: "pilot-2026-08-23",
      },
    });
    // 21 slots vacios: 7 temas x 3.
    await p.journeyStory.createMany({
      data: j.topics.flatMap((t) => [1,2,3].map((slotIndex) => ({
        journeyId: row.id, level: "a0", topic: t, slotIndex, status: "draft" as const,
      }))),
    });
    console.log(`  creado ${j.language}/${j.variant}  id=${row.id}  slots=21`);
  }
  await p.$disconnect();
})();
