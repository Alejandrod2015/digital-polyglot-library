/** Voces asignadas en los journeys de España (por historia), para saber donde se guarda el reparto. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language: "spanish", variant: "spain", status: { in: ["active", "draft"] } }, select: { id: true, name: true, levels: true, status: true } });
  for (const j of js) {
    const r = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { voiceId: true, practiceVoiceId: true, cast: true, audioUrl: true } });
    const voces = new Set(r.map((x) => x.voiceId).filter(Boolean));
    console.log(`${j.name} ${j.levels.join("/")} ${j.status}: ${r.length} historias · con audio ${r.filter((x) => x.audioUrl).length} · voiceId ${r.filter((x) => x.voiceId).length} (${[...voces].join(",")}) · cast ${r.filter((x) => x.cast).length} · practica ${r.filter((x) => x.practiceVoiceId).length}`);
  }
  await p.$disconnect();
})();
