import { prisma } from "../src/lib/prisma";
async function main() {
  const j = await prisma.journey.findUnique({
    where: { id: "cmt0a8vb1000m32p1x7r5ba28" },
    select: { id: true, name: true, status: true, language: true, variant: true, levels: true, typeSlug: true, createdBy: true, nextJourneyId: true },
  });
  console.log("JOURNEY", JSON.stringify(j, null, 2));
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: "cmt0a8vb1000m32p1x7r5ba28" },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { id: true, slug: true, title: true, topic: true, slotIndex: true, status: true, coverUrl: true, coverDone: true, audioUrl: true, audioStatus: true, voiceId: true, synopsis: true, text: true, cast: true },
  });
  console.log("COUNT", stories.length);
  for (const s of stories) {
    console.log("\n===== " + s.topic + " slot" + s.slotIndex + " " + s.id + " " + s.slug);
    console.log("TITLE:", s.title);
    console.log("STATUS:", s.status, "| cover:", s.coverUrl ? "YES" : "no", s.coverDone, "| audio:", s.audioUrl ? "YES" : "no", s.audioStatus, "| voice:", s.voiceId);
    console.log("CAST:", JSON.stringify(s.cast));
    console.log("SYNOPSIS:", s.synopsis);
    console.log("TEXT:", s.text);
  }
  await prisma.$disconnect();
}
main();
