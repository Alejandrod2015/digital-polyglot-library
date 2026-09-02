/**
 * MUESTRA (no lote): titulo + primer parrafo de "Once anos tarde", con el
 * narrador peruano, para que el usuario juzgue voz y ritmo antes de
 * comprometer las 21 historias.
 *
 * Pasa por el pipeline de produccion a proposito, no por un curl suelto: en un
 * render de una sola voz `generateAndUploadMultiVoiceAudio` FUERZA
 * disableStitching + el gate F0 anti-uptalk (scripts/_f0gate.py) + el gate de
 * contenido, y aplica loudnorm y el hueco de 1,10 s tras el titulo. Asi la
 * muestra suena como sonara la toma final.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";

const JOURNEY = "cmtgelq560007j84n3ujx9bpd";
const SLUG = "once-anos-tarde";
// Terry (PE): Marisol es limena y sale en las 21, asi que el narrador es
// peruano en todo el journey, no el del pais de cada escena.
const NARRADOR_PE = "ulJB4yAMefhHYn0FWgGy";

const prisma = new PrismaClient();

(async () => {
  const s = await prisma.journeyStory.findFirst({
    where: { journeyId: JOURNEY, slug: SLUG },
    select: { title: true, text: true },
  });
  if (!s?.text) throw new Error("historia sin texto");

  const parrafo = s.text.split(/\n\n+/)[0].trim();
  const palabras = parrafo.split(/\s+/).length;
  console.log(`titulo:  ${s.title}`);
  console.log(`parrafo: ${palabras} palabras`);

  const res = await generateAndUploadMultiVoiceAudio({
    title: s.title,
    storyText: parrafo,
    voiceMap: { narrator: NARRADOR_PE },
    language: "spanish",
    antiUptalkGate: true,
    contentGate: true,
  });

  console.log("\nURL:", res.url);
  console.log("archivo:", res.filename);
  const dur = (res as { durationSec?: number }).durationSec;
  if (typeof dur === "number") {
    console.log(`duracion: ${dur.toFixed(1)}s · ritmo ${(palabras / dur).toFixed(2)} palabras/s`);
  }
})().finally(() => prisma.$disconnect());
