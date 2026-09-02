/**
 * MUESTRA (no lote): titulo + primer parrafo de la primera historia del A2,
 * para juzgar voz y ritmo antes de comprometer las 21.
 *
 * Pasa por el pipeline de produccion a proposito: en un render de una sola voz
 * `generateAndUploadMultiVoiceAudio` FUERZA disableStitching + el gate F0
 * anti-uptalk (scripts/_f0gate.py) + el gate de contenido, y aplica loudnorm y
 * el hueco de 1,10 s tras el titulo. Asi la muestra suena como la toma final.
 *
 * Narrador AR (Lionel). Con el journey ya local vuelve a valer la convencion
 * del A0 y el A1 latam: el narrador es el del PAIS DE LA ESCENA, y el tema 1
 * pasa entero en Rosario. Terry (PE) narrara los temas 4 y 5.
 *
 * Uso (con el verbo de audio del usuario):
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_muestraA2Titulo.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";

const JOURNEY = "cmtgelq560007j84n3ujx9bpd";
const SLUG = "once-anos-tarde";
const NARRADOR_AR = "MjtZn5tagxL1RO6w9ER5";

const prisma = new PrismaClient();

(async () => {
  const s = await prisma.journeyStory.findFirst({
    where: { journeyId: JOURNEY, slug: SLUG },
    select: { title: true, text: true },
  });
  if (!s?.text) throw new Error("historia sin texto");

  const parrafo = s.text.split(/\n\n+/)[0].trim();
  console.log(`titulo:  ${s.title}`);
  console.log(`parrafo: ${parrafo.split(/\s+/).length} palabras`);
  console.log(parrafo);

  const res = await generateAndUploadMultiVoiceAudio({
    title: s.title,
    storyText: parrafo,
    voiceMap: { narrator: NARRADOR_AR },
    language: "spanish",
    antiUptalkGate: true,
    contentGate: true,
  });

  console.log("\nURL:", res.url);
})().finally(() => prisma.$disconnect());
