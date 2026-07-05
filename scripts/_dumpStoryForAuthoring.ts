// Dump a story's vocab + text + voice + segments for practice-set authoring.
// Usage: npx tsx scripts/_dumpStoryForAuthoring.ts <slug>
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const slug = process.argv[2];
  if (!slug) throw new Error("usage: _dumpStoryForAuthoring.ts <slug>");
  const s = await prisma.journeyStory.findFirst({ where: { slug },
    select: { text: true, vocab: true, voiceId: true, audioSegments: true, dialogueSpec: true } });
  if (!s) throw new Error("story not found: " + slug);
  console.log("voiceId:", s.voiceId);
  console.log("--- VOCAB ---");
  for (const w of (s.vocab as any[]) || []) console.log(`- ${w.word} | ${w.surface ?? ""} | ${w.type ?? ""}`);
  console.log("--- SPEAKER VOICES (for listen_choose voiceId) ---");
  const seen = new Map<string, string>();
  for (const seg of ((s as any).dialogueSpec as any[]) || []) if (seg.speaker && !seen.has(seg.speaker.toLowerCase())) seen.set(seg.speaker.toLowerCase(), seg.voice);
  for (const [sp, v] of seen) console.log(`${sp} -> ${v}`);
  console.log("--- DIALOGUE LINES (speaker of each line) ---");
  for (const seg of ((s as any).dialogueSpec as any[]) || []) console.log(`${seg.speaker}: ${String(seg.text).slice(0, 90)}`);
  console.log("--- SEGMENTS (exact texts for listen_choose) ---");
  for (const g of (s.audioSegments as any[]) || []) console.log(JSON.stringify(g.text));
  console.log("--- TEXT ---"); console.log(s.text);
})().finally(() => prisma.$disconnect());
