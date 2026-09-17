import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * Smoke del firmador de audio.
 *
 * Recorre las FORMAS de payload que entregan audio (historia, secciones,
 * catalogo, clips de practica, respuestas del Studio) y comprueba que, con
 * MEDIA_SIGNED_AUDIO encendido, ninguna sale con el host publico de R2.
 *
 *   MEDIA_SIGNED_AUDIO=1 npx tsx scripts/_smokeUrlsFirmadas.ts --dry
 *   MEDIA_SIGNED_AUDIO=1 npx tsx scripts/_smokeUrlsFirmadas.ts
 *
 * El flag se pasa SOLO como variable del proceso. No se escribe en .env:
 * encenderlo de verdad es una decision de la fase 3, no de un smoke.
 *
 * --dry usa formas de ejemplo y no toca ni la base ni la red. Sin --dry lee
 * filas reales de la base para firmar lo que hay publicado de verdad.
 */

import {
  signAudioFragments,
  signAudioUrl,
  signAudioUrlsDeep,
  signCatalogAudioUrl,
  isSignedAudioFlagOn,
} from "../src/lib/mediaSigning";

type Caso = { nombre: string; salida: unknown };

function hostPublico(): string {
  const raw = (process.env.MEDIA_STORAGE_PUBLIC_BASE_URL || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).host;
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

const HOST = hostPublico();
const MP3 = `https://${HOST || "pub-ejemplo.r2.dev"}/media/generated/audio/historia_demo.mp3`;
const CLIP = `https://${HOST || "pub-ejemplo.r2.dev"}/media/practice-clips/demo/seg-1.mp3`;

function casosDeEjemplo(): Caso[] {
  return [
    { nombre: "stories/[slug] (audioUrl)", salida: signAudioUrl(MP3) },
    {
      nombre: "audioFragments (secciones)",
      salida: signAudioFragments([
        { index: 0, speaker: "Ana", url: MP3, prevUrl: MP3, text: "hola" },
      ]),
    },
    { nombre: "catalogo por nombre de archivo", salida: signCatalogAudioUrl("venecia-01") },
    { nombre: "catalogo por URL", salida: signCatalogAudioUrl(MP3) },
    {
      nombre: "practica (items / exercises)",
      salida: signAudioUrlsDeep({
        items: [{ word: "casi", audioClip: { clipUrl: CLIP, cachedUrl: null }, wordClipUrl: MP3 }],
        exercises: [{ id: "e1", payload: { audioClip: { clipUrl: CLIP } } }],
      }),
    },
    {
      nombre: "studio audio-editor (master + preview + secciones)",
      salida: signAudioUrlsDeep({
        audioUrl: MP3,
        audioUrlPreview: MP3,
        titleSectionUrl: MP3,
        blocks: [{ sectionUrl: MP3, prevSectionUrl: MP3 }],
      }),
    },
    {
      nombre: "portadas (NO se firman, siguen publicas)",
      salida: signAudioUrlsDeep({ coverUrl: `https://${HOST}/media/catalog/images/tapa.jpg` }),
    },
  ];
}

async function casosDeLaBase(): Promise<Caso[]> {
  // Cliente propio: src/lib/prisma arrastra `server-only`, que tsx no puede
  // cargar. Es la misma salida que usan los demas scripts.
  const { PrismaClient } = await import("../src/generated/prisma");
  const prisma = new PrismaClient();
  const casos: Caso[] = [];

  const historia = await prisma.journeyStory.findFirst({
    where: { audioUrl: { not: null } },
    select: { slug: true, audioUrl: true, audioFragments: true },
  });
  if (historia) {
    casos.push({ nombre: `journeyStory ${historia.slug}`, salida: signAudioUrl(historia.audioUrl) });
    casos.push({
      nombre: `journeyStory ${historia.slug} (fragments)`,
      salida: signAudioFragments(historia.audioFragments),
    });
  }

  const propia = await prisma.userStory.findFirst({
    where: { audioUrl: { not: null } },
    select: { slug: true, audioUrl: true },
  });
  if (propia) {
    casos.push({ nombre: `userStory ${propia.slug}`, salida: signAudioUrl(propia.audioUrl) });
  }

  // El clip de practica casi nunca esta en `audioUrl`: vive dentro del payload
  // (`audioClip.clipUrl`, `wordClipUrl`), que es justo lo que el firmador tiene
  // que recorrer en profundidad. Por eso se buscan filas CON clip, no filas con
  // audioUrl.
  const conClip = await prisma.$queryRawUnsafe<Array<{ id: string; payload: unknown }>>(
    `select id, payload from "dp_story_practice_exercises_v1"
     where payload::text like '%/media/%' limit 3`
  );
  for (const ejercicio of conClip) {
    casos.push({
      nombre: `practica ${ejercicio.id}`,
      salida: signAudioUrlsDeep({ payload: ejercicio.payload }),
    });
  }
  if (conClip.length === 0) {
    console.log("  (aviso) no se encontro ninguna fila de practica con clip en el payload");
  }

  await prisma.$disconnect();
  return casos;
}

async function main() {
  const dry = process.argv.includes("--dry");

  if (!isSignedAudioFlagOn()) {
    console.error(
      "MEDIA_SIGNED_AUDIO no esta encendido en ESTE proceso. Corre:\n" +
        "  MEDIA_SIGNED_AUDIO=1 npx tsx scripts/_smokeUrlsFirmadas.ts --dry"
    );
    process.exit(1);
  }
  if (!HOST) {
    console.error("MEDIA_STORAGE_PUBLIC_BASE_URL no esta configurado: no hay host que buscar.");
    process.exit(1);
  }

  console.log(`Host publico que NO debe aparecer: ${HOST}`);
  console.log(dry ? "Modo: --dry (formas de ejemplo)\n" : "Modo: filas reales de la base\n");

  const casos = dry ? casosDeEjemplo() : [...casosDeEjemplo(), ...(await casosDeLaBase())];

  let fallos = 0;
  for (const caso of casos) {
    const json = JSON.stringify(caso.salida ?? null);
    // La portada es el unico caso donde el host publico es correcto.
    const esperado = caso.nombre.startsWith("portadas");
    const filtra = json.includes(HOST);
    const ok = esperado ? filtra : !filtra;
    if (!ok) fallos += 1;
    console.log(`  ${ok ? "ok  " : "FUGA"}  ${caso.nombre}`);
    if (!ok && !esperado) {
      console.log(`        ${json.slice(0, 240)}`);
    }
  }

  console.log(`\n${casos.length - fallos}/${casos.length} sin rastro del host publico`);
  if (fallos > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
