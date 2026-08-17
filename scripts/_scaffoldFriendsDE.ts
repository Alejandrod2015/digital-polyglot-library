import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
// Journey DE C1 "Friends" (germany): 7 ciudades, cada tema su color regional.
// El journey ya existe; esto solo crea los 21 slots draft vacíos (sin text/vocab).
const JOURNEY_ID = "cmroo4w4v0000324ow1o9qlcp";
const TOPICS = ["berlin", "hamburg", "koeln", "muenchen", "ruhrgebiet", "leipzig", "schwaben"];
(async () => {
  const p = new PrismaClient();
  let created = 0, existed = 0;
  for (const topic of TOPICS) {
    for (let slot = 1; slot <= 3; slot++) {
      const dup = await p.journeyStory.findFirst({ where: { journeyId: JOURNEY_ID, topic, slotIndex: slot }, select: { id: true } });
      if (dup) { existed++; continue; }
      await p.journeyStory.create({ data: { journeyId: JOURNEY_ID, level: "c1", topic, slotIndex: slot, status: "draft" } });
      created++;
    }
  }
  console.log(`slots created=${created} existed=${existed} (journey ${JOURNEY_ID})`);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
