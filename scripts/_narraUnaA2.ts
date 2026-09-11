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
 *         npx tsx scripts/_narraUnaA2.ts <slug> [--journey a2 | b1-latam | b2-latam]
 *
 * Antes de narrar, el modo en seco dice que voz y que paso del orden toca a
 * cada historia, con las mismas funciones:  npx tsx scripts/_narraSeco.ts --journey <perfil>
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
import { rapidasDe, informe } from "./checkNarrationPace";
import { perfilDeArgs, vozDe, pasoDelOrden, muestrasRegistradas } from "./_narraPerfiles";

// Ampliado el 2026-09-07 para el B1 latam y el 2026-09-11 para el B2 latam
// (pedir-una-vez): los perfiles viven en _narraPerfiles.ts; sin flag, el A2.
const PERFIL = perfilDeArgs(process.argv);
const JOURNEY = PERFIL.journey;

const prisma = new PrismaClient();

(async () => {
  const slug = process.argv[2];
  if (!slug) throw new Error("falta el slug");

  const s = await prisma.journeyStory.findFirst({
    where: { journeyId: JOURNEY, slug },
    select: { id: true, slug: true, title: true, text: true, topic: true, slotIndex: true, audioUrl: true, voiceId: true },
  });
  if (!s?.text) throw new Error(`no encuentro la historia ${slug}`);
  // Pisar audio existente exige decirlo: --rehacer. Sin eso, no se toca.
  const rehacer = process.argv.includes("--rehacer");
  if (s.audioUrl && !rehacer) {
    throw new Error(`${slug} YA tiene audio; para rehacerlo pasa --rehacer`);
  }

  const voiceId = vozDe(PERFIL, s);

  // ORDEN DE NARRACION POR TEMA (regla dura, 2026-09-02). Primero la muestra
  // de titulo y primer parrafo, que el usuario comprueba; luego la primera
  // historia entera, que vuelve a comprobar; y solo entonces el resto del
  // tema. Cada paso se para hasta que el anterior existe, porque narrar de
  // golpe y equivocarse cuesta creditos y ya paso dos veces.
  const primera = s.slotIndex > 1
    ? await prisma.journeyStory.findFirst({
        where: { journeyId: JOURNEY, topic: s.topic, slotIndex: 1 },
        select: { slug: true, audioUrl: true },
      })
    : null;
  const orden = pasoDelOrden({ ...s, audioUrl: null }, muestrasRegistradas(), !!primera?.audioUrl);
  if (orden.paso === "muestra" && !rehacer) {
    throw new Error(
      `${slug} es la PRIMERA de su tema y no tiene muestra.\n` +
      `  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_muestraA2Titulo.ts ${slug}` +
      (process.argv.includes("--journey") ? ` --journey ${process.argv[process.argv.indexOf("--journey") + 1]}` : "")
    );
  }
  if (orden.paso === "resto del tema" && orden.bloqueo) {
    throw new Error(
      `la primera de este tema (${primera?.slug}) todavia no esta narrada.\n` +
      `  El orden es: muestra, primera entera, y luego el resto.`
    );
  }

  // Ninguna historia se narra con glosas copiadas sin leer: el audio es lo caro
  // y es justo donde el error se vuelve irreversible. Ver checkGlossesReviewed.
  const sets = await prisma.tapGlossSet.findMany({
    where: { bundle: PERFIL.bundle },
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
      `  npx tsx scripts/reviewCopiedGlosses.ts ${PERFIL.bundle} --pend`
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

  // RITMO POR ORACION (2026-09-08). Cada oracion se sintetiza aparte y sale con
  // su propio ritmo; el desnivel DENTRO de una historia no lo miraba nadie
  // (normalizeAudioPace empareja historias enteras entre si, que es otra cosa)
  // hasta que el usuario oyo una frase disparada a 3,45 w/s en una historia de
  // mediana 2,31. Se mide AQUI, recien narrada y con los tiempos frescos,
  // porque arreglarlo ahora cuesta re-tirar UNA oracion y descubrirlo mas
  // tarde cuesta el master entero. Imprime el comando de arreglo ya calculado.
  {
    const fin = await prisma.journeyStory.findUnique({
      where: { id: s.id }, select: { audioSegments: true, audioFragments: true },
    });
    const rapidas = rapidasDe((fin?.audioSegments as any) ?? [], (fin?.audioFragments as any) ?? []);
    console.log(informe(s.slug ?? "", rapidas));
  }
})().finally(() => prisma.$disconnect());
