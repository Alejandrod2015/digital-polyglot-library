import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmqfnp3tf000032afygkqp8z2", voiceId: { not: null } }, select: { slug: true, voiceId: true, practiceVoiceId: true } });
  for (const r of rows) console.log("voiceId suelto:", r.slug, r.voiceId, "| practice:", r.practiceVoiceId);
  await p.$disconnect();
})();
