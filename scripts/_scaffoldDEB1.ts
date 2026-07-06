// Scaffold: German B1 "Expat" journey (Berlin, sobrevivir Alemania).
// Creates the Journey row (status archived: hidden from the app until launch)
// + 21 empty draft story slots. Stories are written later via /generate-story.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

// Curriculum order = the expat's real chronology in Berlin.
const TOPICS = [
  "arrival-and-registration",   // llegar, Anmeldung, primeros días
  "housing-and-flatshare",      // WG, Kaution, vecinos, Hausordnung
  "work-and-office",            // primer día, colegas, du/Sie, Feierabend
  "bureaucracy-and-paperwork",  // Ausländerbehörde, banco, seguro, Termine
  "everyday-life-and-shopping", // Pfand, Öffnungszeiten, BVG, mercado
  "friends-and-free-time",      // Verein, small talk, Stammtisch, parque
  "health-and-emergencies",     // médico, Termin, farmacia, urgencias
];

(async () => {
  const p = new PrismaClient();
  const existing = await p.journey.findFirst({ where: { language: "german", variant: "germany", levels: { has: "b1" } } });
  if (existing) { console.log("ya existe:", existing.id, existing.status); await p.$disconnect(); return; }
  const j = await p.journey.create({ data: {
    name: "Expat", language: "german", variant: "germany",
    levels: ["b1"], topics: TOPICS, storiesPerTopic: 3, status: "archived", // oculto hasta el launch: cualquier estado no-archived enciende "alemán" en el picker mobile
  } });
  console.log("journey creado:", j.id);
  let n = 0;
  for (const topic of TOPICS) for (let slot = 1; slot <= 3; slot++) {
    await p.journeyStory.create({ data: { journeyId: j.id, level: "b1", topic, slotIndex: slot, status: "draft" } });
    n++;
  }
  console.log(`${n} slots draft creados. JOURNEY_ID=${j.id}`);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
