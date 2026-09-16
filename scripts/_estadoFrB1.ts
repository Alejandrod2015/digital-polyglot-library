import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { existsSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const JID = "cmu0doigc0007j8e292tycths";
  const j: any = await p.journey.findUnique({ where: { id: JID } });
  console.log("JOURNEY:", j.id, "| status:", j.status, "| lang:", j.language, "| variant:", j.variant, "| level:", j.level, "| cefr:", j.cefrLevel);
  const stories: any[] = await p.journeyStory.findMany({
    where: { journeyId: JID },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    include: { practiceSet: true },
  });
  console.log("historias:", stories.length,
    "| audioUrl:", stories.filter(s=>s.audioUrl).length,
    "| cover:", stories.filter(s=>s.coverUrl).length,
    "| practiceSet:", stories.filter(s=>s.practiceSet).length,
    "| voiceId distintos:", [...new Set(stories.map(s=>s.voiceId))].join(","),
    "| practiceVoiceId:", [...new Set(stories.map(s=>s.practiceVoiceId))].join(","));
  for (const s of stories) {
    const f = `scripts/_sets/${s.slug}.json`;
    console.log([s.topic, s.slotIndex, s.slug, s.audioUrl?"AUD":"-", s.coverUrl?"COV":"-", s.practiceSet?"SET":"-", existsSync(f)?"JSON":"-"].join(" | "));
  }
  await p.$disconnect();
})();
