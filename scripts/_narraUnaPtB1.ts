/**
 * Narra UNA historia del Traveler PT-BR B1, entera, con la voz de narracion
 * del journey. El entregable es ese audio completo y el usuario lo pidio: por
 * eso corre con el opt-in consciente DPL_AUDIO_FULL_OK=1 del guard 6d
 * (sample-first).
 *
 * Adaptado de scripts/_narraUnaA2.ts: una sola voz para TODO el journey (no
 * por tema, a diferencia del A2 latam que narra cada pais con su narrador),
 * asi que FUERZA disableStitching + gate F0 anti-uptalk (_f0gate) + gate de
 * contenido, loudnorm y el hueco de 1,10 s tras el titulo. Despues alinea los
 * tiempos de palabra, que es de donde el lector pinta el karaoke.
 *
 * Uso:  DPL_AUDIO_FULL_OK=1 NODE_OPTIONS="--conditions=react-server" \
 *         npx tsx scripts/_narraUnaPtB1.ts <slug>
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
import { assertVoiceApproved } from "../src/lib/approvedVoices";
import * as fs from "fs";
import * as path from "path";

const JOURNEY = "cmtrcpgso00073232h8vaf7na";
const BUNDLE = "portuguese-traveler-brazil-b1";
import { NARRATOR_VOICE } from "./_ptB1Voces";

const prisma = new PrismaClient();

(async () => {
  const slug = process.argv[2];
  if (!slug) throw new Error("falta el slug");

  const s = await prisma.journeyStory.findFirst({
    where: { journeyId: JOURNEY, slug },
    select: { id: true, slug: true, title: true, text: true, topic: true, slotIndex: true, audioUrl: true },
  });
  if (!s?.text) throw new Error(`no encuentro la historia ${slug}`);
  // Pisar audio existente exige decirlo: --rehacer. Sin eso, no se toca.
  if (s.audioUrl && !process.argv.includes("--rehacer")) {
    throw new Error(`${slug} YA tiene audio; para rehacerlo pasa --rehacer`);
  }

  assertVoiceApproved(NARRATOR_VOICE, `ptb1:${slug}`);

  // ORDEN DE NARRACION POR TEMA (regla dura, 2026-09-02). Primero la muestra
  // de titulo y primer parrafo, que el usuario comprueba; luego la primera
  // historia entera, que vuelve a comprobar; y solo entonces el resto del
  // tema. Cada paso se para hasta que el anterior existe.
  const REGISTRO = path.join(__dirname, "ptb1-muestras.json");
  const muestras = fs.existsSync(REGISTRO)
    ? (JSON.parse(fs.readFileSync(REGISTRO, "utf8")) as Record<string, unknown>)
    : {};
  if (s.slotIndex === 1 && !muestras[s.slug] && !process.argv.includes("--rehacer")) {
    throw new Error(
      `${slug} es la PRIMERA de su tema y no tiene muestra.\n` +
      `  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_muestraPtB1Titulo.ts ${slug}`
    );
  }
  if (s.slotIndex > 1) {
    const primera = await prisma.journeyStory.findFirst({
      where: { journeyId: JOURNEY, topic: s.topic, slotIndex: 1 },
      select: { slug: true, audioUrl: true },
    });
    if (!primera?.audioUrl) {
      throw new Error(
        `la primera de este tema (${primera?.slug}) todavia no esta narrada.\n` +
        `  El orden es: muestra, primera entera, y luego el resto.`
      );
    }
  }

  // Ninguna historia se narra con glosas copiadas sin leer.
  const sets = await prisma.tapGlossSet.findMany({
    where: { bundle: BUNDLE },
    select: { glosses: true },
  });
  const pend = sets.reduce(
    (n, r) => n + Object.values((r.glosses ?? {}) as Record<string, { rev?: boolean }>)
      .filter((v) => v?.rev === false).length,
    0
  );
  if (pend > 0) {
    throw new Error(
      `${pend} glosas copiadas sin leer en este paquete. Leelas antes de narrar:\n` +
      `  npx tsx scripts/reviewCopiedGlosses.ts ${BUNDLE} --pend`
    );
  }

  console.log(`${s.slug} · ${s.title} · tema ${s.topic}`);
  console.log(`${s.text.split(/\s+/).length} palabras · voz ${NARRATOR_VOICE}`);

  await prisma.journeyStory.update({ where: { id: s.id }, data: { audioStatus: "generating" } });

  const result = await generateAndUploadMultiVoiceAudio({
    storyText: s.text, title: s.title, voiceMap: { narrator: NARRATOR_VOICE },
    language: "portuguese", disableStitching: true, antiUptalkGate: true, contentGate: true,
  } as any);
  if (!result) throw new Error("el render devolvio null");

  await prisma.journeyStory.update({
    where: { id: s.id },
    data: {
      audioUrl: result.url, audioSegments: result.audioSegments as any,
      audioFilename: result.filename, audioStatus: "ready", voiceId: NARRATOR_VOICE,
      audioQaStatus: result.audioQa?.status ?? null, audioQaScore: result.audioQa?.score ?? null,
      audioQaNotes: result.audioQa?.notes?.join("\n") ?? null,
      ...(result.fragments?.length ? { audioFragments: result.fragments as object } : {}),
    },
  });
  console.log("master:", result.url);

  try { await generateWordTimingsForStory(s.id); console.log("alineacion OK"); }
  catch (e: any) { console.warn("alineacion FALLO:", e.message?.slice(0, 140)); }
})().finally(() => prisma.$disconnect());
