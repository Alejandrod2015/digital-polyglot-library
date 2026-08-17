import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import path from "path";

const AMB = (f: string) => path.resolve(__dirname, "tts", "ambience", f);
// ambient por ESCENA (no fijo): {file, vol} o null = seco
const AMBIENT: Record<string, { file: string; vol: number } | null> = {
  "el-baul-de-la-abuela":     { file: "calle.mp3",       vol: 0.04 }, // interior piso
  "plantas-en-la-terraza":    { file: "calle.mp3",       vol: 0.08 }, // azotea, exterior
  "la-junta-de-vecinos":      { file: "cafeteria_es.mp3", vol: 0.05 }, // portal, murmullo de gente
  "el-arroz-de-la-huerta":    { file: "cocina_es.mp3",     vol: 0.06 }, // prep paella, huerta
  "sin-socarrat":             { file: "cocina_es.mp3",     vol: 0.07 }, // dos paellas al fuego
  "la-paella-del-domingo":    { file: "restaurante_es.mp3", vol: 0.05 }, // banquete familiar
};

async function run() {
  const slug = process.argv.find(a => a.startsWith("--slug="))?.split("=")[1];
  if (!slug) { console.error("--slug= requerido"); process.exit(1); }
  const p = new PrismaClient();
  const s = await p.journeyStory.findFirst({ where: { slug } });
  if (!s?.text || !s.title || !s.dialogueSpec) { console.error("falta text/title/dialogueSpec"); process.exit(1); }

  const voiceMap: Record<string,string> = {};
  for (const seg of s.dialogueSpec as any[]) if (seg.speaker && seg.voice) voiceMap[seg.speaker] = seg.voice;
  const amb = AMBIENT[slug] ?? null;
  console.log(`${slug}: voces ${Object.keys(voiceMap).join(", ")} | ambient ${amb ? amb.file+" @ "+amb.vol : "seco"}`);

  await p.journeyStory.update({ where: { id: s.id }, data: { audioStatus: "generating" } });
  const result = await generateAndUploadMultiVoiceAudio({
    storyText: s.text, title: s.title, voiceMap,
    ambientPath: amb ? AMB(amb.file) : null, ambientVolume: amb?.vol,
    language: "spanish", disableStitching: true,
  });
  if (!result) { console.error("null"); process.exit(1); }
  const { mergeVoiceProvenance } = await import("../src/lib/voiceProvenance");
  await p.journeyStory.update({ where: { id: s.id }, data: {
    audioUrl: result.url, audioFilename: result.filename, audioSegments: result.audioSegments as any,
    audioStatus: "ready", voiceId: voiceMap.narrator,
    voiceProvenance: mergeVoiceProvenance(s.voiceProvenance, { dryUrl: result.dryUrl, dryFilename: result.dryFilename, previewDryUrl: null, previewDryFilename: null }) as any,
  }});
  console.log("✅ " + result.url);
  await p.$disconnect();
}
run().catch(e => { console.error(e); process.exit(1); });
