// scripts/_tpAlign.ts
//
// Genera los tiempos de palabra (karaoke) de una pieza de Talking Points.
//
//   npx tsx scripts/_tpAlign.ts warum-keine-karte
//
// Usa `alignStoryAudio`, exactamente lo mismo que corre para las historias de
// journey: alineacion forzada con aeneas en Modal. NO transcribe, alinea el
// texto que ya tenemos contra el audio, asi que no depende de ninguna API de
// transcripcion.
//
// Se importa `alignStoryAudio` directo y no el wrapper que vive junto a
// `lib/prisma`, porque ese arrastra `server-only` y aborta el proceso en tsx.
// Mismo motivo que documenta backfillJourneyAeneasAlignment.ts.
//
// Solo imprime el JSON. Pegarlo en `audioWordTimings` de la pieza.

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { alignStoryAudio } from "../src/lib/alignStoryAudio";
import { getPiece } from "../src/lib/talkingPoints";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Uso: npx tsx scripts/_tpAlign.ts <slug>");
    process.exit(1);
  }

  const found = getPiece(slug);
  if (!found) {
    console.error(`No existe la pieza "${slug}".`);
    process.exit(1);
  }
  const { topic, piece } = found;
  if (!piece.audioUrl) {
    console.error(`La pieza "${slug}" no tiene audio todavia.`);
    process.exit(1);
  }

  console.error(`Alineando "${piece.title}" (${topic.language})...`);

  const { payload, segments } = await alignStoryAudio({
    text: piece.body.join("\n\n"),
    title: piece.title,
    audioUrl: piece.audioUrl,
    language: topic.language,
    storyId: piece.slug,
  });

  console.error(
    `ok -> ${payload.words.length} tokens, ${segments.length} segmentos, duracion ${payload.audioDurationSec ?? "?"}s`
  );
  process.stdout.write(JSON.stringify({ payload, segments }));
}

main().catch((err) => {
  console.error("fallo:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
