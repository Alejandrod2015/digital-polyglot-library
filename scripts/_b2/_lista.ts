import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language: "spanish", status: { not: "archived" } }, select: { id: true, name: true, typeSlug: true, levels: true, variant: true, status: true, topics: true, storiesPerTopic: true, nextJourneyId: true } });
  for (const j of js) console.log(JSON.stringify(j));
  await p.$disconnect();
})();
