import { config } from "dotenv"; config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language: "italian", status: { in: ["active","draft"] } },
    select: { id: true, name: true, levels: true, status: true, variant: true,
      stories: { select: { voiceId: true, practiceVoiceId: true, audioUrl: true } } } });
  for (const j of js) {
    const v = [...new Set(j.stories.map(s => s.voiceId).filter(Boolean))];
    const pv = [...new Set(j.stories.map(s => s.practiceVoiceId).filter(Boolean))];
    console.log(`${j.name.padEnd(9)} ${JSON.stringify(j.levels).padEnd(7)} ${j.status.padEnd(7)} audio=${j.stories.filter(s=>s.audioUrl).length}/${j.stories.length} narrador=${v.join(",")||"-"} practica=${pv.join(",")||"-"}`);
  }
  await p.$disconnect();
})();
