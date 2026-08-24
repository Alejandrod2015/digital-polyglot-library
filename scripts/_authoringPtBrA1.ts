/** Vuelca el material de autoría de práctica para una historia: cada plaza con
 *  su lema, superficie, tipo, definición y la oración del cuerpo donde sale. */
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { slug: true, text: true, vocab: true, practiceVoiceId: true, voiceId: true } });
  if (!s) { console.log("no existe"); await p.$disconnect(); return; }
  const frases = (s.text ?? "").split(/\n\s*\n/).flatMap((x) => x.split(/(?<=[.!?…”])\s+/)).map((x) => x.trim()).filter(Boolean);
  console.log(`voz práctica: ${s.practiceVoiceId ?? s.voiceId}`);
  for (const v of (s.vocab as Array<{ word: string; surface?: string; type?: string; definition?: string }>)) {
    const sup = v.surface ?? v.word;
    const ex = frases.find((f) => f.includes(sup)) ?? "";
    console.log(`${v.word}\t${sup}\t${v.type ?? ""}\t${v.definition ?? ""}\t${ex.slice(0, 110)}`);
  }
  await p.$disconnect();
})();
