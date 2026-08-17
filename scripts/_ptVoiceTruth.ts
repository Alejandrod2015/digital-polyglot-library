import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const j = await p.journey.findFirst({
    where: { language: { equals: "portuguese", mode: "insensitive" } },
    select: { id: true },
  });
  if (!j) return;
  const s = await p.journeyStory.findMany({
    where: { journeyId: j.id, status: "published" },
    select: { title: true, voiceId: true, practiceVoiceId: true },
  });
  const narr = new Map<string, number>();
  for (const x of s) narr.set(x.voiceId ?? "(null)", (narr.get(x.voiceId ?? "(null)") ?? 0) + 1);
  console.log("Quién NARRA las 21 historias:");
  for (const [v, n] of narr) console.log(`   ${v} → ${n} historias`);
  console.log("\npracticeVoiceId:", [...new Set(s.map((x) => x.practiceVoiceId ?? "(null)"))].join(", "));

  const ejs = await p.storyPracticeExercise.findMany({
    where: { set: { story: { journeyId: j.id } } },
    select: { audioVoiceId: true, type: true },
  });
  const ev = new Map<string, number>();
  for (const e of ejs) ev.set(e.audioVoiceId ?? "(null)", (ev.get(e.audioVoiceId ?? "(null)") ?? 0) + 1);
  console.log("\nVoz guardada en los ejercicios (audioVoiceId):");
  for (const [v, n] of ev) console.log(`   ${v} → ${n} ejercicios`);
  const match = ejs.filter((e) => e.type === "match_meaning");
  console.log(`   de los ${match.length} match: ${match.filter((e) => e.audioVoiceId).length} con voz, ${match.filter((e) => !e.audioVoiceId).length} sin voz`);
}
main().finally(() => p.$disconnect());
