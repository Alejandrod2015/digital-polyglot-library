import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio, parseDialogueSegments } from "../src/lib/elevenlabs";
import path from "path";

const SLUG = "el-baul-de-la-abuela";
const voiceMap: Record<string,string> = {
  narrator: "Yqxik8v3XlyYOTWnDIVu", // Roque
  Marta:    "f18RlRJGEw0TaGYwmk8B", // Alba (F joven)
  Hugo:     "w8u1dIxiWVelUtUQg1MB", // Volu (M joven); reemplaza a Luca (sobreactuado)
  Rosario:  "RTuKyXJgRGAQSx8Qz8Mf", // Tete (F mayor / abuela)
};

async function run() {
  const prisma = new PrismaClient();
  const story = await prisma.journeyStory.findFirst({ where: { slug: SLUG } });
  if (!story?.text || !story.title) { console.error("no story/text"); process.exit(1); }

  const speakers = [...new Set(parseDialogueSegments(story.text).map(s => s.speaker))];
  const missing = speakers.filter(s => !Object.keys(voiceMap).map(k=>k.toLowerCase()).includes(s.toLowerCase()));
  if (missing.length) { console.error("speakers sin voz:", missing); process.exit(1); }
  console.log("speakers:", speakers.join(", "));

  await prisma.journeyStory.update({ where: { id: story.id }, data: { audioStatus: "generating" } });
  console.log("generando multi-voz (ElevenLabs v2)...");
  const result = await generateAndUploadMultiVoiceAudio({
    storyText: story.text, title: story.title, voiceMap,
    ambientPath: path.resolve(__dirname, "tts", "ambience", "calle.mp3"), ambientVolume: 0.04, language: "spanish", disableStitching: true,
  });
  if (!result) { console.error("generación devolvió null"); process.exit(1); }

  const { mergeVoiceProvenance } = await import("../src/lib/voiceProvenance");
  const provenance = mergeVoiceProvenance(story.voiceProvenance, {
    dryUrl: result.dryUrl, dryFilename: result.dryFilename, previewDryUrl: null, previewDryFilename: null,
  });
  await prisma.journeyStory.update({ where: { id: story.id }, data: {
    audioUrl: result.url, audioFilename: result.filename, audioSegments: result.audioSegments as any,
    audioStatus: "ready", voiceId: voiceMap.narrator, voiceProvenance: provenance as any,
    audioQaStatus: result.audioQa?.status ?? null, audioQaScore: result.audioQa?.score ?? null,
    audioQaNotes: result.audioQa?.notes?.join("\n") ?? null,
  }});
  console.log("\n✅ AUDIO LISTO");
  console.log("URL:", result.url);
  console.log("QA:", result.audioQa?.status, result.audioQa?.score ?? "");
  await prisma.$disconnect();
}
run().catch(e => { console.error(e); process.exit(1); });
