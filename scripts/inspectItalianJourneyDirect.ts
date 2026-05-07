import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
config({ path: ".env.local" });
config({ path: ".env" });

async function run() {
  const userId = process.argv[2];
  if (!userId) { console.error("Usage: tsx ... <userId>"); process.exit(1); }
  const prisma = new PrismaClient();

  // Italian journeys
  const journeys = await prisma.journey.findMany({
    where: { language: { equals: "italian", mode: "insensitive" }, status: { not: "archived" } },
    include: { stories: { where: { status: "published", NOT: [{ text: null }, { title: null }] }, orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }] } },
  });
  console.log(`Italian journeys: ${journeys.length}`);

  // User's audio metrics
  const metrics = await prisma.userMetric.findMany({
    where: { userId, eventType: { in: ["audio_complete", "continue_listening"] } },
    select: { storySlug: true, eventType: true, metadata: true },
  });
  const completed = new Set<string>();
  const COMPLETE_RATIO = 0.95;
  for (const m of metrics) {
    const md = m.metadata as Record<string, unknown> | null;
    const pk = md?.progressKey && typeof md.progressKey === "string" && md.progressKey.trim() ? md.progressKey.trim() : null;
    const key = pk ?? (m.storySlug ? `standalone:${m.storySlug}` : null);
    if (!key) continue;
    if (m.eventType === "audio_complete") { completed.add(key); continue; }
    const ps = typeof md?.progressSec === "number" ? md.progressSec : null;
    const ad = typeof md?.audioDurationSec === "number" ? md.audioDurationSec : null;
    if (ps !== null && ad !== null && ad > 0 && ps >= ad * COMPLETE_RATIO) completed.add(key);
  }
  console.log(`User ${userId} completedKeys: ${completed.size}`);
  for (const c of completed) console.log(`  ${c}`);

  for (const j of journeys) {
    console.log(`\nJourney ${j.name} (variant=${j.variant}, levels=${j.levels.length}, stories=${j.stories.length})`);
    let nextFound = false;
    for (const story of j.stories) {
      const progressKey = `standalone:${story.slug}`;
      const audioFinished = completed.has(progressKey);
      if (audioFinished) {
        console.log(`  audioFinished: ${story.level}/${story.topic}/${story.slug} — ${story.title}`);
      } else if (!nextFound) {
        nextFound = true;
        console.log(`  >>> NEXT: ${story.level}/${story.topic}/${story.slug} — ${story.title}`);
      }
    }
    if (!nextFound) console.log("  >>> NO NEXT");
  }
  await prisma.$disconnect();
}
run().catch(e => { console.error(e); process.exit(1); });
