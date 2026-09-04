/**
 * Palabras por minuto REALES de los journeys que ya tienen narracion.
 * Prioriza los tiempos de karaoke (`audioWordTimings`), que son la duracion
 * medida del audio ya renderizado; cae a `audioSegments` si no hay.
 * Solo lectura, no toca ElevenLabs.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

const JOURNEYS: Array<[string, string]> = [
  ["A1 latam", "cmt5vxwgd0007324oesy195k8"],
  ["A2 latam", "cmtgelq560007j84n3ujx9bpd"],
];

function finalSeconds(timings: unknown, segments: unknown): number | null {
  // Los tiempos de karaoke llegan como { words: [{ startSec, endSec }] } y los
  // segmentos como array de frases con startSec/endSec. La duracion util es el
  // endSec del ultimo elemento: es el audio ya renderizado, no una estimacion.
  const t = timings as { words?: Array<Record<string, unknown>> } | null;
  const w = t && Array.isArray(t.words) ? t.words : null;
  if (w && w.length) {
    const v = w[w.length - 1]?.["endSec"];
    if (typeof v === "number" && v > 0) return v;
  }
  const segs = Array.isArray(segments) ? (segments as Array<Record<string, unknown>>) : null;
  if (segs && segs.length) {
    const v = segs[segs.length - 1]?.["endSec"];
    if (typeof v === "number" && v > 0) return v;
  }
  return null;
}

(async () => {
  for (const [label, id] of JOURNEYS) {
    const ss = await p.journeyStory.findMany({
      where: { journeyId: id, NOT: { audioUrl: null } },
      select: { slug: true, wordCount: true, audioWordTimings: true, audioSegments: true },
    });
    const filas: Array<{ w: number; s: number }> = [];
    for (const s of ss) {
      const sec = finalSeconds(s.audioWordTimings, s.audioSegments);
      if (sec && s.wordCount) filas.push({ w: s.wordCount, s: sec });
    }
    if (!filas.length) { console.log(`${label}: sin duraciones medibles (${ss.length} con audio)`); continue; }
    const wpm = filas.map((f) => (f.w / f.s) * 60);
    const media = wpm.reduce((a, b) => a + b, 0) / wpm.length;
    const segs = filas.map((f) => f.s).sort((a, b) => a - b);
    const palabras = filas.map((f) => f.w).sort((a, b) => a - b);
    const fmt = (x: number) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, "0")}`;
    console.log(
      `${label}: ${filas.length} historias · palabras ${palabras[0]}-${palabras[palabras.length - 1]} ` +
      `· duracion ${fmt(segs[0])} a ${fmt(segs[segs.length - 1])} (mediana ${fmt(segs[Math.floor(segs.length / 2)])}) ` +
      `· ${media.toFixed(0)} palabras/minuto`,
    );
  }
  await p.$disconnect();
})();
