/**
 * Genera MUESTRAS de voz: solo el 1er párrafo de la 1ra historia de cada tema,
 * cada una con el narrador de su región. NO toca las filas de las historias
 * (audioUrl intacto); solo sube un mp3 de muestra y devuelve la URL.
 * GATED (ElevenLabs). Usage:
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_genFriendsVoiceSamples.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";

const JOURNEY_ID = "cmrdqk484000032r4rt2vw4ej";
const SAMPLES: { slug: string; voice: string; label: string }[] = [
  { slug: "pilar-no-entiende-nada",    voice: "FXGrCtY3PEyfqczBAlqm", label: "T6 Lima · Jhenny (reemplaza a elena)" },
];

async function run() {
  const prisma = new PrismaClient();
  const out: { label: string; slug: string; para: string; url: string }[] = [];
  for (const s of SAMPLES) {
    const story = await prisma.journeyStory.findFirst({ where: { slug: s.slug, journeyId: JOURNEY_ID }, select: { text: true } });
    if (!story?.text) { console.error(`[${s.slug}] sin texto`); continue; }
    const para1 = story.text.split(/\n{2,}/)[0].trim();
    console.log(`\n[${s.label}] sintetizando ¶1 (${para1.split(/\s+/).length} palabras)...`);
    const result = await generateAndUploadMultiVoiceAudio({
      storyText: para1, title: "", voiceMap: { narrator: s.voice },
      language: "spanish", disableStitching: true,
    });
    if (!result?.url) { console.error(`[${s.slug}] fallo`); continue; }
    out.push({ label: s.label, slug: s.slug, para: para1, url: result.url });
    console.log(`[${s.label}] -> ${result.url}`);
  }
  await prisma.$disconnect();
  // volcar para armar la página de audición
  const fs = await import("fs");
  fs.writeFileSync("/tmp/friends_voice_samples.json", JSON.stringify(out, null, 1));
  console.log(`\nOK ${out.length}/7 muestras. JSON -> /tmp/friends_voice_samples.json`);
}
run().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
