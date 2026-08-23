import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const J = "cmqfnp3tf000032afygkqp8z2";
  const rows = await p.journeyStory.findMany({ where: { journeyId: J }, select: { slug: true, voiceId: true, practiceVoiceId: true, cast: true } });
  const conVoz = rows.filter((r) => r.voiceId).length;
  const conCast = rows.filter((r) => r.cast && Object.keys(r.cast as object).length).length;
  console.log(`ESTE journey: ${rows.length} historias · con voiceId ${conVoz} · con cast ${conCast}`);
  // como lo tiene un journey multivoz que YA suena
  const otros = await p.journeyStory.findMany({
    where: { journey: { language: "german", status: { not: "archived" } }, journeyId: { not: J }, cast: { not: undefined } },
    select: { slug: true, voiceId: true, cast: true, journey: { select: { name: true, levels: true } } },
    take: 3,
  });
  for (const o of otros) {
    console.log(`\n${o.journey?.name} ${JSON.stringify(o.journey?.levels)} · ${o.slug}`);
    console.log("  voiceId:", o.voiceId);
    console.log("  cast:", JSON.stringify(o.cast).slice(0, 300));
  }
  await p.$disconnect();
})();
