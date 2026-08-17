import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

// Cast Expat (journeyCasts.ts): narrator=moritz, Nadia=ela_warm, Timo=marius
const VOICES: Record<string, string> = {
  narrator: "Ww7Sq9tx9CCOiNOwWgsx", // moritz
  nadia: "SJJe86Va82zRzg6zi2dX",    // ela_warm
  timo: "JDXBO1etYlVlJZRMoYzH",     // marius
};

(async () => {
  const s = await prisma.journeyStory.findFirst({
    where: { slug: "buergeramt-neukoelln-sieben-uhr" },
    select: { id: true, text: true },
  });
  if (!s?.text) throw new Error("story not found");
  const spec: Array<{ text: string; voice: string; speaker: string }> = [];
  for (const para of s.text.split(/\n\s*\n/)) {
    const t = para.trim();
    if (!t) continue;
    const m = t.match(/^(Timo|Nadia):\s*([\s\S]+)$/);
    if (m) {
      const speaker = m[1];
      spec.push({ text: m[2].trim(), voice: VOICES[speaker.toLowerCase()], speaker });
    } else {
      spec.push({ text: t, voice: VOICES.narrator, speaker: "narrator" });
    }
  }
  // sanity: cada segmento con voz, texto no vacío
  for (const seg of spec) {
    if (!seg.voice || !seg.text) throw new Error(`segmento inválido: ${JSON.stringify(seg)}`);
  }
  await prisma.journeyStory.update({ where: { id: s.id }, data: { dialogueSpec: spec } });
  const bySpeaker = spec.reduce<Record<string, number>>((a, x) => ((a[x.speaker] = (a[x.speaker] ?? 0) + 1), a), {});
  console.log(`spec guardado: ${spec.length} segmentos`, bySpeaker);
})().finally(() => prisma.$disconnect());
