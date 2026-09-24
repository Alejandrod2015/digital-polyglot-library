/**
 * Engancha a las 21 filas del Conversations ES latam A0 el audio que ya vive en
 * R2, leyendo el mapa `audio-r2.json`. No sintetiza, no sube y no toca el texto
 * ni el vocab: solo `audioUrl`, `audioFilename`, `audioStatus` y `voiceId`.
 *
 * El mapa se escribio al subir los masters; esto es el otro extremo del mismo
 * hilo, para que dejen de ser ficheros sin fila. La ALINEACION (karaoke) no
 * entra aqui: sin `audioWordTimings` el lector cae en la vista sin resaltado y
 * `lint:karaoke-fresh` se salta la historia, que es lo correcto mientras no se
 * alinee.
 *
 *   npx tsx scripts/_esLatamA0Conversations/enganchaAudio.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";

const JID = "cmub5my8d000432ye0v6pv5ng";
const MAPA = "scripts/_esLatamA0Conversations/audio-r2.json";
/** Superior Welcoming & casual, el narrador aprobado del journey. */
const NARRADOR = "IaUx9NjPDJeDAwpNQMW2";
const prisma = new PrismaClient();

(async () => {
  const dry = process.argv.includes("--dry");
  const mapa = JSON.parse(fs.readFileSync(MAPA, "utf8")) as Record<string, {
    audioUrl: string; audioFilename: string; topic: string; slotIndex: number;
  }>;
  const filas = await prisma.journeyStory.findMany({
    where: { journeyId: JID },
    select: { id: true, slug: true, topic: true, slotIndex: true, audioUrl: true },
  });

  let puestos = 0, ya = 0, sinMapa: string[] = [];
  for (const f of filas) {
    const m = Object.values(mapa).find((x) => x.topic === f.topic && x.slotIndex === f.slotIndex);
    if (!m) { sinMapa.push(`${f.topic}#${f.slotIndex}`); continue; }
    if (f.audioUrl === m.audioUrl) { ya++; continue; }
    console.log(`${dry ? "[--dry] " : ""}${f.slug ?? `${f.topic}#${f.slotIndex}`} -> ${m.audioFilename}`);
    if (!dry) {
      await prisma.journeyStory.update({
        where: { id: f.id },
        data: { audioUrl: m.audioUrl, audioFilename: m.audioFilename, audioStatus: "ready", voiceId: NARRADOR },
      });
    }
    puestos++;
  }
  console.log(`\n${filas.length} filas · ${puestos} ${dry ? "por enganchar" : "enganchadas"} · ${ya} ya estaban`);
  if (sinMapa.length) console.error(`SIN master en el mapa: ${sinMapa.join(", ")}`);
  await prisma.$disconnect();
})().catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); });
