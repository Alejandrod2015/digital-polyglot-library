/**
 * MUESTRA del narrador del Friends ES A0 argentino: titulo + PRIMER PARRAFO de
 * la primera historia, con Malena (p7AwDmKvTdoHTBuueGvP, aprobada 2026-08-23).
 *
 * Sample-first: no renderiza la historia entera. Pasa por el MISMO camino de
 * produccion que el render completo (generateAndUploadMultiVoiceAudio, stitching
 * OFF + gate F0 anti-uptalk), asi que los segmentos quedan en la cache
 * content-addressed y la muestra ES la toma final: cuando se narre el journey
 * entero, estos parrafos no se vuelven a pagar.
 *
 * NO escribe en la base. GATED: solo corre con el verbo de audio del usuario.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_arSample.ts
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";

const JOURNEY = "cmt5vx8du000732fjgkwi59ks";
const VOICE = "p7AwDmKvTdoHTBuueGvP"; // Malena (AR), aprobada 2026-08-23
const SLUG = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1] ?? "el-sobre-del-dueno";

(async () => {
  const prisma = new PrismaClient();
  const s = await prisma.journeyStory.findFirst({
    where: { journeyId: JOURNEY, slug: SLUG },
    select: { title: true, text: true, journey: { select: { language: true } } },
  });
  await prisma.$disconnect();
  if (!s?.text || !s.title) throw new Error(`sin historia: ${SLUG}`);
  const primero = s.text.split("\n\n")[0];
  console.log(`muestra: "${s.title}" + parrafo 1 (${primero.split(/\s+/).length} palabras)\n`);
  console.log(primero + "\n");
  const r = await generateAndUploadMultiVoiceAudio({
    storyText: primero, title: s.title, voiceMap: { narrator: VOICE },
    language: s.journey.language ?? "spanish",
    disableStitching: true, antiUptalkGate: true,
  } as any);
  if (!r) throw new Error("multi-voice devolvio null");
  console.log(`\nmp3: ${r.url}`);
  console.log(`QA: ${r.audioQa?.status ?? "?"} ${r.audioQa?.score ?? ""}`);
})().catch((e) => { console.error(e); process.exit(1); });
