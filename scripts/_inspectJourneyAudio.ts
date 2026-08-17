import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const wc = (t: string) => (t || "").trim().split(/\s+/).filter(Boolean).length;
function rate(frags: any[]) {
  let words = 0, speak = 0;
  for (const f of frags) { words += wc(f.text); speak += f.endSec - f.startSec; }
  return speak > 0 ? { words, artic: +(words / speak).toFixed(2), speak: +speak.toFixed(1) } : { words, artic: 0, speak: 0 };
}
(async () => {
  const journeys = await prisma.journey.findMany({
    where: { language: "spanish" },
    select: { id: true, name: true, language: true, variant: true, topics: true },
  });
  for (const j of journeys) {
    console.log(`\n=== ${j.name} | ${j.language}/${j.variant} | id=${j.id}`);
    const stories = await prisma.journeyStory.findMany({
      where: { journeyId: j.id },
      select: { slug: true, topic: true, slotIndex: true, audioUrl: true, audioFragments: true, dialogueSpec: true },
      orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    });
    let withA = 0, without = 0;
    for (const s of stories) {
      const frags: any[] = Array.isArray(s.audioFragments) ? (s.audioFragments as any) : [];
      const hasAudio = !!s.audioUrl;
      const dsKeys = s.dialogueSpec && typeof s.dialogueSpec === "object" ? Object.keys(s.dialogueSpec as any).length : 0;
      const r = hasAudio ? rate(frags) : null;
      if (hasAudio) withA++; else without++;
      console.log(`   ${hasAudio ? "AUD" : "   "} ${(s.slug || "?").padEnd(30)} ${r && r.artic ? `artic=${r.artic} (${r.words}w, frags=${frags.length})` : (hasAudio ? "audio SIN frags" : "sin audio")}  ds=${dsKeys}`);
    }
    console.log(`  -> ${withA} con audio, ${without} sin audio`);
  }
  await prisma.$disconnect();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
