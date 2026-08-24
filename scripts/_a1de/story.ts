import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { slug: "wieder-in-dresden" },
    select: { slug: true, title: true, voiceId: true, audioUrl: true, audioStatus: true, updatedAt: true,
              journey: { select: { id: true, name: true, language: true, variant: true, levels: true, status: true } } },
  });
  if (!rows.length) { console.log("no existe ninguna historia con ese slug"); return; }
  for (const r of rows) {
    console.log(`"${r.title}"`);
    console.log(`  journey: ${r.journey?.name} ${r.journey?.language}/${r.journey?.variant} ${JSON.stringify(r.journey?.levels)} (${r.journey?.status}) id=${r.journey?.id}`);
    console.log(`  voiceId: ${r.voiceId}`);
    console.log(`  audio:   ${r.audioStatus} · ${r.audioUrl ? "con mp3" : "sin mp3"}`);
    console.log(`  updated: ${r.updatedAt.toISOString()}`);
  }
  await p.$disconnect();
})();
