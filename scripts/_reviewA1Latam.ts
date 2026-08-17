import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const J = "cmqp6hal8000032cb4ywfs0gc"; // ES LATAM A1 (real)

(async () => {
  const journey = await prisma.journey.findUnique({
    where: { id: J },
    select: { name: true, language: true, variant: true, levels: true, topics: true, status: true },
  });
  console.log("JOURNEY:", JSON.stringify(journey, null, 2));
  const topicOrder = new Map((journey?.topics ?? []).map((t, i) => [t, i] as const));

  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: J },
    select: {
      id: true, slug: true, title: true, synopsis: true, level: true, topic: true,
      slotIndex: true, status: true, wordCount: true, vocabCount: true, vocab: true,
      arcType: true, register: true, culturalTags: true, coverUrl: true, coverDone: true,
      audioUrl: true, audioStatus: true, voiceId: true, dialogueSpec: true, cast: true,
      audioQaStatus: true, auditScore: true, text: true,
    },
  });
  stories.sort((a, b) => {
    const ao = topicOrder.get(a.topic) ?? 1e9, bo = topicOrder.get(b.topic) ?? 1e9;
    return ao !== bo ? ao - bo : a.slotIndex - b.slotIndex;
  });

  console.log(`\n=== ${stories.length} HISTORIAS (orden currículo) ===\n`);
  for (const s of stories) {
    const spec: any = s.dialogueSpec;
    const sp = Array.isArray(spec) ? [...new Set(spec.map((x: any) => `${x.speaker}=${x.voice?.slice(0,6)}`))] : null;
    const vocabArr: any = s.vocab;
    console.log(`#${topicOrder.get(s.topic) ?? "?"} [${s.topic}] slot${s.slotIndex} L=${s.level}  «${s.title}»  (${s.slug})`);
    console.log(`   status=${s.status} | words=${s.wordCount} vocab=${s.vocabCount}(real=${Array.isArray(vocabArr)?vocabArr.length:"?"}) | arc=${s.arcType}`);
    console.log(`   cover=${s.coverDone?"Y":"-"} | audio=${s.audioStatus}${s.audioUrl?"(url)":""} | voiceId=${s.voiceId?.slice(0,6)||"-"} | audioQA=${s.audioQaStatus??"-"} | audit=${s.auditScore??"-"}`);
    console.log(`   distinct speakers: ${sp?sp.join(", "):"(sin dialogueSpec)"}`);
    console.log(`   register=${JSON.stringify(s.register)} cultural=${JSON.stringify(s.culturalTags)}`);
    console.log(`   synopsis: ${s.synopsis ?? "(vacío)"}\n`);
  }

  console.log("\n\n========== CUERPOS COMPLETOS (lectura gestalt) ==========\n");
  for (const s of stories) {
    console.log(`\n##### #${topicOrder.get(s.topic)} «${s.title}»; ${s.topic} (${s.slug})\n`);
    console.log(s.text ?? "(SIN TEXTO)");
    console.log("\n---");
  }
  await prisma.$disconnect();
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
