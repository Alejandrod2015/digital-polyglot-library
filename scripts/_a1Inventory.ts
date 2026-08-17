import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const j = await prisma.journey.findFirst({ where: { status: "active", levels: { has: "a1" } }, select: { id: true, topics: true } });
  if (!j) throw new Error("A0 journey not found");
  console.log("topics order:", JSON.stringify(j.topics));
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: j.id, status: "published" },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { slug: true, topic: true, slotIndex: true, voiceId: true, practiceVoiceId: true, vocab: true, wordCount: true, dialogueSpec: true },
  });
  for (const s of stories) {
    const v = (s.vocab as any[]) || [];
    const spec = (s.dialogueSpec as any[]) || [];
    const speakers = [...new Set(spec.map((x: any) => x.speaker?.toLowerCase()))];
    console.log(`${s.topic}/${s.slotIndex} ${s.slug} | vocab=${v.length} | words=${s.wordCount} | narrator=${s.voiceId} | speakers=${speakers.join(",")}`);
  }
})().finally(() => prisma.$disconnect());
