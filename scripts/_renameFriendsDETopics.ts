import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const JOURNEY_ID = "cmroo4w4v0000324ow1o9qlcp";
const RENAME: Record<string, string> = { ruhrgebiet: "dortmund", schwaben: "stuttgart" };
const NEW_TOPICS = ["berlin", "hamburg", "koeln", "muenchen", "dortmund", "leipzig", "stuttgart"];
(async () => {
  const p = new PrismaClient();
  for (const [oldT, newT] of Object.entries(RENAME)) {
    const r = await p.journeyStory.updateMany({ where: { journeyId: JOURNEY_ID, topic: oldT }, data: { topic: newT } });
    console.log(`slots ${oldT} -> ${newT}: ${r.count}`);
  }
  await p.journey.update({ where: { id: JOURNEY_ID }, data: { topics: NEW_TOPICS } });
  console.log("journey.topics =", NEW_TOPICS.join(", "));
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
