/**
 * MUESTRA: titulo + primer parrafo de UNA historia del Traveler PT-BR B1,
 * para que el usuario juzgue voz y ritmo ANTES de narrar la historia entera.
 *
 * Adaptado de scripts/_muestraA2Titulo.ts (mismo pipeline, journey e idioma
 * distintos). Primer paso obligatorio del orden de narracion por tema (regla
 * dura, 2026-09-02): muestra -> historia completa -> resto del tema, con una
 * comprobacion del usuario entre paso y paso.
 *
 * PT-BR B1 se narra a UNA sola voz: el texto es prosa narrador con comillas y
 * atribucion en frase ("disse Nilza"), no el formato "Nombre: linea" que
 * necesita el parser multivoz (parseDialogueSegments en src/lib/elevenlabs.ts);
 * con un unico hablante detectado ("narrator"), el guard de multivoz pasa en
 * modo voz unica, igual que en PT-BR A0/A1.
 *
 * Deja constancia en scripts/ptb1-muestras.json, que es lo que mira
 * `_narraUnaPtB1.ts` para no dejar narrar una primera historia sin muestra.
 *
 * Uso: NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_muestraPtB1Titulo.ts <slug>
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { assertVoiceApproved } from "../src/lib/approvedVoices";
import { NARRATOR_VOICE } from "./_ptB1Voces";

const JOURNEY = "cmtrcpgso00073232h8vaf7na";
const REGISTRO = path.join(__dirname, "ptb1-muestras.json");

const prisma = new PrismaClient();

(async () => {
  const slug = process.argv[2];
  if (!slug) throw new Error("falta el slug");

  const s = await prisma.journeyStory.findFirst({
    where: { journeyId: JOURNEY, slug },
    select: { title: true, text: true, topic: true },
  });
  if (!s?.text) throw new Error(`no encuentro la historia ${slug}`);

  assertVoiceApproved(NARRATOR_VOICE, `ptb1-muestra:${slug}`);

  const parrafo = s.text.split(/\n\n+/)[0].trim();
  console.log(`${s.title} · ${parrafo.split(/\s+/).length} palabras · voz ${NARRATOR_VOICE}`);
  console.log(parrafo);

  const res = await generateAndUploadMultiVoiceAudio({
    title: s.title,
    storyText: parrafo,
    voiceMap: { narrator: NARRATOR_VOICE },
    language: "portuguese",
    antiUptalkGate: true,
    contentGate: true,
  });

  const reg = fs.existsSync(REGISTRO) ? JSON.parse(fs.readFileSync(REGISTRO, "utf8")) : {};
  reg[slug] = { url: res.url, fecha: new Date().toISOString(), voiceId: NARRATOR_VOICE };
  fs.writeFileSync(REGISTRO, JSON.stringify(reg, null, 1) + "\n");

  console.log("\nURL:", res.url);
})().finally(() => prisma.$disconnect());
