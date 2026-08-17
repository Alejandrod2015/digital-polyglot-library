import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const stories = await prisma.journeyStory.findMany({
    where: { status: "published", journey: { status: "active" } },
    select: { slug: true, audioUrl: true, audioWordTimings: true, wordCount: true },
  });
  let real = 0, missing = 0, noAudio = 0;
  const details: string[] = [];
  for (const s of stories) {
    if (!s.audioUrl) { noAudio++; continue; }
    const wt = s.audioWordTimings as { words?: unknown[] } | null;
    const n = wt && Array.isArray(wt.words) ? wt.words.length : 0;
    if (n > 0) { real++; details.push(`${s.slug}: ${n} timings / ${s.wordCount}w`); }
    else missing++;
  }
  console.log(`published en journeys activos: ${stories.length}`);
  console.log(`con audio + timings reales: ${real}`);
  console.log(`con audio SIN timings (karaoke sintético): ${missing}`);
  console.log(`sin audio: ${noAudio}`);
  console.log(details.slice(0, 5).join("\n"));
})().finally(() => prisma.$disconnect());
