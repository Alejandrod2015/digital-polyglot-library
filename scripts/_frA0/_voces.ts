// SOLO LECTURA. Voz de narracion y de practica en las historias del journey.
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st: any[] = await p.journeyStory.findMany({ where: { journeyId: "cmtwo6cys0007j8yzg6ni3fsc" }, select: { slug: true, voiceId: true, practiceVoiceId: true } as any });
  const resume = new Map<string, number>();
  for (const s of st) { const k = `voiceId=${s.voiceId ?? "null"} practiceVoiceId=${s.practiceVoiceId ?? "null"}`; resume.set(k, (resume.get(k) ?? 0) + 1); }
  for (const [k, n] of resume) console.log(`${n} historias · ${k}`);
  await p.$disconnect();
})();
