/**
 * Portón de evidencia para los 7 temas del Traveler ES/spain B1.
 * Solo LEE: imprime la tabla y tira si un tema no cita algo escrito por un
 * solicitante. La escritura de la tabla `Topic` vive en createJourney.ts.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { assertTopicsGrounded, type TopicProposal } from "../../src/lib/topicEvidence";

export const B1_TOPICS: TopicProposal[] = [
  { label: "Winter & Empty Houses", slug: "winter-and-empty-houses",
    evidence: ["Holiday home in Spain"] },
  { label: "Jobs & Wages", slug: "jobs-and-wages",
    evidence: ["for my job and friends"] },
  { label: "Storms & The Sea", slug: "storms-and-the-sea",
    evidence: ["when travelling to Spain"] },
  { label: "Repeating & Rephrasing", slug: "repeating-and-rephrasing",
    evidence: ["instantly check translations"] },
  { label: "Sayings & Nicknames", slug: "sayings-and-nicknames",
    evidence: ["understand and use slang"] },
  { label: "Deals & Estimates", slug: "deals-and-estimates",
    evidence: ["Conduct full business meetings in Spanish"] },
  { label: "Trust & Rumours", slug: "trust-and-rumours",
    evidence: ["know peoples secrets"] },
];

export const B1_EXISTING_LABELS = [
  "Neighbours & Favours", "Timetables & Meal Times", "Bars & Tapas",
  "Family & Relatives", "Plans & Invitations", "Health & Symptoms",
  "Festivals & Traditions",
];

if (require.main === module) {
  assertTopicsGrounded({ language: "spanish", proposals: B1_TOPICS, existingLabels: B1_EXISTING_LABELS })
    .then(() => console.log("PORTON OK"))
    .catch((e) => { console.error(String(e.message ?? e)); process.exit(1); })
    .finally(() => process.exit(0));
}
