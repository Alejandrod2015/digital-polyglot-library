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
 * Uso: NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_muestraA2Titulo.ts <slug> [--journey a2 | b1-latam | b2-latam]
 */
// PRIMERO, y de efecto lateral: ver scripts/_loadEnv.ts. Un config() de dotenv
// escrito aqui arriba corre DESPUES de cargarse elevenlabs.ts, porque los
// import se izan.
import "./_loadEnv";

import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { perfilDeArgs, vozDe, REGISTRO_MUESTRAS } from "./_narraPerfiles";

// Ampliado el 2026-09-07 para el B1 latam y el 2026-09-11 para el B2 latam
// (pedir-una-vez: se amplia el script en un commit, no se clona): los perfiles
// viven en _narraPerfiles.ts; sin flag, el A2 de siempre.
const PERFIL = perfilDeArgs(process.argv);
const JOURNEY = PERFIL.journey;

const prisma = new PrismaClient();

(async () => {
  const slug = process.argv[2];
  if (!slug) throw new Error("falta el slug");

  const s = await prisma.journeyStory.findFirst({
    where: { journeyId: JOURNEY, slug },
    select: { slug: true, title: true, text: true, topic: true, voiceId: true },
  });
  if (!s?.text) throw new Error(`no encuentro la historia ${slug}`);

  const voiceId = vozDe(PERFIL, s);

  const parrafo = s.text.split(/\n\n+/)[0].trim();
  console.log(`${s.title} · ${parrafo.split(/\s+/).length} palabras · voz ${voiceId}`);
  console.log(parrafo);

  const res = await generateAndUploadMultiVoiceAudio({
    title: s.title,
    storyText: parrafo,
    voiceMap: { narrator: voiceId },
    language: PERFIL.language ?? "spanish",
    antiUptalkGate: true,
    contentGate: true,
  });

  const reg = fs.existsSync(REGISTRO_MUESTRAS) ? JSON.parse(fs.readFileSync(REGISTRO_MUESTRAS, "utf8")) : {};
  reg[slug] = { url: res.url, fecha: new Date().toISOString(), voiceId };
  fs.writeFileSync(REGISTRO_MUESTRAS, JSON.stringify(reg, null, 1) + "\n");

  // Los gateFlags del render se imprimian solo al narrar la historia entera,
  // asi que de una muestra se perdian: el pipeline los calcula, nadie los mira
  // y se informa "sin flags" sin haberlo comprobado. Aqui no se re-tira nada
  // (2026-09-16, la narracion ya no re-tira sola): se dicen y decide el usuario.
  const flags = res.gateFlags ?? [];
  console.log(flags.length ? `gateFlags: ${JSON.stringify(flags)}` : "gateFlags: ninguno");

  console.log("\nURL:", res.url);
})().finally(() => prisma.$disconnect());
