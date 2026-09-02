/**
 * Narra UNA historia del A2 latam, entera, con el narrador del pais de su tema.
 * El entregable es ese audio completo y el usuario lo pidio: por eso corre con
 * el opt-in consciente DPL_AUDIO_FULL_OK=1 del guard 6d (sample-first).
 *
 * Mismo camino que el runner del catalogo: una sola voz, asi que el pipeline
 * FUERZA disableStitching + gate F0 anti-uptalk (_f0gate) + gate de contenido,
 * loudnorm y el hueco de 1,10 s tras el titulo. Despues alinea los tiempos de
 * palabra, que es de donde el lector pinta el karaoke.
 *
 * SIN re-pace: el usuario aprobo de oido la muestra tal como sale de la voz
 * (~2,3 palabras/s). Aplicar el 2,7 del A0 cambiaria justo lo que aprobo.
 *
 * Uso:  DPL_AUDIO_FULL_OK=1 NODE_OPTIONS="--conditions=react-server" \
 *         npx tsx scripts/_narraUnaA2.ts <slug>
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";

const JOURNEY = "cmtgelq560007j84n3ujx9bpd";
/** Narrador por tema: el del pais de la escena, como en el A0 y el A1 latam. */
const VOZ_POR_TEMA: Record<string, string> = {
  "friends-and-reunions": "MjtZn5tagxL1RO6w9ER5",        // Lionel, AR (Rosario)
  "staying-with-locals": "yHD4CsKkghm19ToGLJEC",         // Hernando, CO (Salento)
  "jokes-and-misunderstandings": "yHD4CsKkghm19ToGLJEC", // Hernando, CO (Medellin)
  "borders-and-crossings": "ulJB4yAMefhHYn0FWgGy",       // Terry, PE (Santa Rosa)
  "secrets-and-curiosity": "ulJB4yAMefhHYn0FWgGy",       // Terry, PE (Arequipa)
  "work-trips-and-meetings": "JW8DGEuLp9WxIS5IdxMM",     // Andreti, MX (Guadalajara)
  "local-life-and-routines": "JW8DGEuLp9WxIS5IdxMM",     // Andreti, MX (Merida)
};

const prisma = new PrismaClient();

(async () => {
  const slug = process.argv[2];
  if (!slug) throw new Error("falta el slug");

  const s = await prisma.journeyStory.findFirst({
    where: { journeyId: JOURNEY, slug },
    select: { id: true, slug: true, title: true, text: true, topic: true, audioUrl: true },
  });
  if (!s?.text) throw new Error(`no encuentro la historia ${slug}`);
  // Pisar audio existente exige decirlo: --rehacer. Sin eso, no se toca.
  if (s.audioUrl && !process.argv.includes("--rehacer")) {
    throw new Error(`${slug} YA tiene audio; para rehacerlo pasa --rehacer`);
  }

  const voiceId = VOZ_POR_TEMA[s.topic];
  if (!voiceId) throw new Error(`sin narrador para el tema ${s.topic}`);

  // Ninguna historia se narra con glosas copiadas sin leer: el audio es lo caro
  // y es justo donde el error se vuelve irreversible. Ver checkGlossesReviewed.
  const sets = await prisma.tapGlossSet.findMany({
    where: { bundle: "spanish-traveler-latam-a2" },
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
      `  npx tsx scripts/reviewCopiedGlosses.ts spanish-traveler-latam-a2 --pend`
    );
  }

  console.log(`${s.slug} · ${s.title} · tema ${s.topic}`);
  console.log(`${s.text.split(/\s+/).length} palabras · voz ${voiceId}`);

  await prisma.journeyStory.update({ where: { id: s.id }, data: { audioStatus: "generating" } });

  const result = await generateAndUploadMultiVoiceAudio({
    storyText: s.text, title: s.title, voiceMap: { narrator: voiceId },
    language: "spanish", disableStitching: true, antiUptalkGate: true, contentGate: true,
  } as any);
  if (!result) throw new Error("el render devolvio null");

  await prisma.journeyStory.update({
    where: { id: s.id },
    data: {
      audioUrl: result.url, audioSegments: result.audioSegments as any,
      audioFilename: result.filename, audioStatus: "ready", voiceId,
      audioQaStatus: result.audioQa?.status ?? null, audioQaScore: result.audioQa?.score ?? null,
      audioQaNotes: result.audioQa?.notes?.join("\n") ?? null,
      ...(result.fragments?.length ? { audioFragments: result.fragments as object } : {}),
    },
  });
  console.log("master:", result.url);

  try { await generateWordTimingsForStory(s.id); console.log("alineacion OK"); }
  catch (e: any) { console.warn("alineacion FALLO:", e.message?.slice(0, 140)); }
})().finally(() => prisma.$disconnect());
