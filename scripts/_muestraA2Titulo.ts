/**
 * MUESTRA: titulo + primer parrafo de UNA historia, para que el usuario juzgue
 * voz y ritmo ANTES de narrar la historia entera.
 *
 * Es el primer paso obligatorio del orden de narracion por tema (regla dura,
 * 2026-09-02): muestra -> historia completa -> resto del tema, con una
 * comprobacion del usuario entre paso y paso.
 *
 * Pasa por el pipeline de produccion a proposito: en un render de una sola voz
 * `generateAndUploadMultiVoiceAudio` FUERZA disableStitching + el gate F0
 * anti-uptalk (scripts/_f0gate.py) + el gate de contenido, y aplica loudnorm y
 * el hueco de 1,10 s tras el titulo. Asi la muestra suena como la toma final.
 *
 * Deja constancia en scripts/a2-muestras.json, que es lo que mira
 * `_narraUnaA2.ts` para no dejar narrar una primera historia sin muestra.
 *
 * Uso: NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_muestraA2Titulo.ts <slug>
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { VOZ_POR_TEMA } from "./_a2Voces";

const JOURNEY = "cmtgelq560007j84n3ujx9bpd";
const REGISTRO = path.join(__dirname, "a2-muestras.json");

const prisma = new PrismaClient();

(async () => {
  const slug = process.argv[2];
  if (!slug) throw new Error("falta el slug");

  const s = await prisma.journeyStory.findFirst({
    where: { journeyId: JOURNEY, slug },
    select: { title: true, text: true, topic: true },
  });
  if (!s?.text) throw new Error(`no encuentro la historia ${slug}`);

  const voiceId = VOZ_POR_TEMA[s.topic];
  if (!voiceId) throw new Error(`sin narrador para el tema ${s.topic}`);

  const parrafo = s.text.split(/\n\n+/)[0].trim();
  console.log(`${s.title} · ${parrafo.split(/\s+/).length} palabras · voz ${voiceId}`);
  console.log(parrafo);

  const res = await generateAndUploadMultiVoiceAudio({
    title: s.title,
    storyText: parrafo,
    voiceMap: { narrator: voiceId },
    language: "spanish",
    antiUptalkGate: true,
    contentGate: true,
  });

  const reg = fs.existsSync(REGISTRO) ? JSON.parse(fs.readFileSync(REGISTRO, "utf8")) : {};
  reg[slug] = { url: res.url, fecha: new Date().toISOString(), voiceId };
  fs.writeFileSync(REGISTRO, JSON.stringify(reg, null, 1) + "\n");

  console.log("\nURL:", res.url);
})().finally(() => prisma.$disconnect());
