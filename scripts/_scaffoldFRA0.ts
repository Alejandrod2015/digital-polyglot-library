// Scaffold: French A0 "Traveler" journey (surf en la costa vasca francesa).
// Un solo topic de momento (decisión del usuario 2026-07-07): surf.
// Journey archived: oculto del picker mobile hasta el launch.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const TOPICS = [
  "surf-and-ocean", // Biarritz: escuela de surf, la ola, la playa
];

(async () => {
  const p = new PrismaClient();
  const existing = await p.journey.findFirst({ where: { language: "french", variant: "france", levels: { has: "a0" } } });
  if (existing) { console.log("ya existe:", existing.id, existing.status); await p.$disconnect(); return; }
  const j = await p.journey.create({ data: {
    name: "Traveler", language: "french", variant: "france",
    levels: ["a0"], topics: TOPICS, storiesPerTopic: 3, status: "archived",
  } });
  console.log("journey creado:", j.id);
  let n = 0;
  for (const topic of TOPICS) for (let slot = 1; slot <= 3; slot++) {
    await p.journeyStory.create({ data: { journeyId: j.id, level: "a0", topic, slotIndex: slot, status: "draft" } });
    n++;
  }
  console.log(`${n} slots draft creados. JOURNEY_ID=${j.id}`);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
