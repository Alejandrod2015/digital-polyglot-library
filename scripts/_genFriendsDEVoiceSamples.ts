/**
 * Audición Friends DE: 1 frase real (2 primeras oraciones de la historia #1 de
 * cada ciudad) con la voz del narrador elegido. Solo muestra, NO toca las filas.
 * GATED (ElevenLabs). Uso: NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_genFriendsDEVoiceSamples.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import * as fs from "fs";

const SAMPLES: { city: string; slug: string; voice: string; voiceName: string }[] = [
  { city: "Berlin", slug: "nadia-kriegt-eine-schnauze", voice: "6NPDr9Vi2EfxqmZNbpnD", voiceName: "Lukas" },
  { city: "Hamburg", slug: "muss-ja", voice: "2ltALpVw84RfWfjE0ujH", voiceName: "Hartje" },
  { city: "Koeln", slug: "alaaf-fur-die-neue", voice: "9fvtGcIyqtZAfzFcACPJ", voiceName: "Natalie" },
  { city: "Muenchen", slug: "servus-im-biergarten", voice: "0tZHGqMH9qcKqbqzoN8q", voiceName: "Jonas" },
  { city: "Dortmund", slug: "currywurst-und-viel-gemecker", voice: "pogKz4X3wyIANWzeUynU", voiceName: "Dieter" },
  { city: "Leipzig", slug: "gru-e-von-timo", voice: "6i9HBATmN8DhZRFTlPOK", voiceName: "Daniel" },
  { city: "Stuttgart", slug: "kehrwoche-bei-achim", voice: "Ww7Sq9tx9CCOiNOwWgsx", voiceName: "Moritz Morgenstern" },
];

function firstTwoSentences(text: string): string {
  const para1 = text.split(/\n{2,}/)[0].trim();
  const m = para1.match(/^.*?[.!?"][^.!?]*?[.!?]"?/s);
  return (m ? m[0] : para1).trim();
}

async function run() {
  const prisma = new PrismaClient();
  const out: any[] = [];
  for (const s of SAMPLES) {
    const story = await prisma.journeyStory.findFirst({ where: { slug: s.slug }, select: { text: true } });
    if (!story?.text) { console.error(`[${s.city}] sin texto`); continue; }
    const sample = firstTwoSentences(story.text);
    console.log(`\n[${s.city} · ${s.voiceName}] "${sample.slice(0, 70)}..."`);
    const result = await generateAndUploadMultiVoiceAudio({
      storyText: sample, title: "", voiceMap: { narrator: s.voice },
      language: "german", disableStitching: true,
    } as any);
    if (!result?.url) { console.error(`[${s.city}] fallo`); continue; }
    out.push({ city: s.city, voiceName: s.voiceName, voiceId: s.voice, sample, url: result.url });
    console.log(`[${s.city}] -> ${result.url}`);
  }
  await prisma.$disconnect();
  fs.writeFileSync("/tmp/friendsDE_voice_samples.json", JSON.stringify(out, null, 1));
  console.log(`\nOK ${out.length}/7 muestras -> /tmp/friendsDE_voice_samples.json`);
}
run().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
