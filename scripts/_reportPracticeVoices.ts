import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { APPROVED_VOICES } from "../src/lib/approvedVoices";
import { voiceEngine } from "../src/lib/audioEngine";

const prisma = new PrismaClient();
function classify(v: string | null | undefined): string {
  const eng = voiceEngine(v);
  if (eng === "none") return "NONE";
  if (eng !== "elevenlabs") return `NON-EL(${eng})`;
  return v && Object.prototype.hasOwnProperty.call(APPROVED_VOICES, v.trim()) ? "EL-approved" : "EL-UNAPPROVED";
}

async function main() {
  const sets = await prisma.storyPracticeSet.findMany({
    where: { story: { status: "published" } },
    select: { exercises: { select: { type: true, payload: true, audioUrl: true } } },
  });
  const voices = new Map<string, { cls: string; count: number }>();
  let withCached = 0, withClip = 0, withWordClip = 0, total = 0;
  for (const s of sets) {
    for (const ex of s.exercises) {
      total++;
      const ac = ((ex.payload as Record<string, unknown> | null)?.audioClip ?? null) as Record<string, unknown> | null;
      const vid = typeof ac?.voiceId === "string" ? ac.voiceId : (typeof ac?.wordVoiceId === "string" ? ac.wordVoiceId : null);
      if (ac?.cachedUrl || ex.audioUrl) withCached++;
      if (ac?.clipUrl) withClip++;
      if (ac?.wordClipUrl) withWordClip++;
      const key = (vid ?? "").trim() || "<none>";
      const cls = classify(vid);
      const e = voices.get(key) ?? { cls, count: 0 };
      e.count++; voices.set(key, e);
    }
  }
  console.log(`\n=== PUBLISHED practice exercises: ${total} | con cachedUrl/audioUrl: ${withCached} | clipUrl: ${withClip} | wordClipUrl: ${withWordClip} ===\n`);
  console.log("Voces en audioClip (payload) de práctica publicada:");
  for (const [v, e] of [...voices.entries()].sort((a, b) => a[1].cls.localeCompare(b[1].cls))) {
    console.log(`  ${e.cls.padEnd(16)} ${v}  x${e.count}`);
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
