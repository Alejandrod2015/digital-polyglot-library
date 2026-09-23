/**
 * Que historias de un journey se narraron SIN informe de ritmo por oracion.
 *
 * POR QUE (2026-09-23, Friends ES Mexico A0). El informe de ritmo
 * (`rapidasDe` / `checkNarrationPace`) lee `audioSegments`, y a esa columna la
 * escriben DOS pasos, uno detras de otro:
 *
 *   1. `transcribeAudioSegments` durante la sintesis (whisper-1 de OpenAI). Si
 *      la cuenta de OpenAI no tiene credito devuelve 429, el catch se lo traga
 *      y deja la columna vacia, sin tumbar la narracion.
 *   2. `generateWordTimingsForStory` al alinear (Modal), que la REESCRIBE con
 *      segmentos por oracion y sus tiempos. Este no depende de OpenAI.
 *
 * O sea: mientras la alineacion funcione, el ritmo SI se mide aunque OpenAI
 * este caido. Lo que deja ciego el informe es que fallen los dos, y entonces
 * `rapidasDe` no encuentra oraciones y dice "sin oraciones aceleradas", que es
 * un verde falso. El gate importa: el 2026-09-08 cazo una frase a 3,45
 * palabras/s dentro de una historia de mediana 2,31.
 *
 * La constancia se DERIVA de la base, no se escribe a mano: una historia con
 * audio y con `audioSegments` vacio es una historia cuyo ritmo no midio nadie.
 * Asi no hay lista que mantener ni que se quede atras.
 *
 * Cuando vuelva a haber segmentos, esto se arregla sin gastar un centimo de
 * ElevenLabs: el audio ya esta pagado y solo hay que volver a alinearlo
 * (`scripts/_realinea.ts`).
 *
 *   npx tsx scripts/_ritmoSinMedir.ts --journey mx-a0 [--json]
 */
import "./_loadEnv";

import { PrismaClient } from "../src/generated/prisma";
import { perfilDeArgs } from "./_narraPerfiles";

const prisma = new PrismaClient();

export type FilaRitmo = {
  slug: string;
  topic: string;
  slotIndex: number;
  segmentos: number;
  medido: boolean;
};

export function filasDe(
  historias: { slug: string | null; topic: string; slotIndex: number; audioUrl: string | null; audioSegments: unknown }[]
): FilaRitmo[] {
  return historias
    .filter((h) => h.audioUrl)
    .map((h) => {
      const segs = Array.isArray(h.audioSegments) ? h.audioSegments.length : 0;
      return { slug: h.slug ?? "", topic: h.topic, slotIndex: h.slotIndex, segmentos: segs, medido: segs > 0 };
    });
}

async function main() {
  const perfil = perfilDeArgs(process.argv);
  const historias = await prisma.journeyStory.findMany({
    where: { journeyId: perfil.journey },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { slug: true, topic: true, slotIndex: true, audioUrl: true, audioSegments: true },
  });

  const filas = filasDe(historias);
  const sin = filas.filter((f) => !f.medido);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ journey: perfil.journey, narradas: filas.length, sinMedir: sin }, null, 2));
    return;
  }

  console.log(`narradas: ${filas.length}/${historias.length} · ritmo medido: ${filas.length - sin.length} · SIN MEDIR: ${sin.length}`);
  if (!filas.length) return;
  console.log("\n| historia | tema | segmentos | ritmo |");
  console.log("|---|---|---|---|");
  for (const f of filas) {
    console.log(`| ${f.slug} | ${f.topic} | ${f.segmentos} | ${f.medido ? "medido" : "SIN MEDIR"} |`);
  }
  if (sin.length) {
    console.log(
      `\n${sin.length} historia(s) sin informe de ritmo por oracion: se narraron con la cuenta de ` +
      `OpenAI sin credito, asi que audioSegments vino vacio. El audio ya esta pagado; cuando haya ` +
      `credito se vuelve a transcribir y se mide, sin gastar ElevenLabs.`
    );
  }
}

if (require.main === module) {
  main().finally(() => prisma.$disconnect());
}
