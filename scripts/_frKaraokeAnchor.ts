/**
 * Ancla el ARRANQUE de cada párrafo del karaoke al onset REAL del audio.
 *
 * NO es la vieja corrección de deriva ([[project_karaoke_drift_correction_removed]]),
 * que anclaba en CADA silencio y arrastraba un desfase acumulativo por toda la
 * historia. Aquí solo se toca el párrafo cuyo primer token cae fuera de su
 * ventana real, el resto de sus palabras se reescala dentro del MISMO tramo
 * (el final del párrafo no se mueve) y los párrafos que ya están en su sitio
 * no se tocan.
 *
 * El onset real sale de `ffmpeg silencedetect` a -35 dB, que es fiable a ±30 ms
 * salvo en audios con cama de ambiente (aquí no hay).
 *
 *   npx tsx scripts/_frKaraokeAnchor.ts <slug> [--apply]
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const p = new PrismaClient();
const TOL = 0.15;   // por debajo de esto no se toca: es el suelo de la regla

function onsets(mp3: Buffer): number[] {
  const dir = mkdtempSync(join(tmpdir(), "ka-"));
  const f = join(dir, "a.mp3");
  writeFileSync(f, mp3);
  // silencedetect escribe en STDERR; sin capturarlo la lista sale vacía y el
  // script ancla todo a 0, que fue el primer intento.
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", f, "-af", "silencedetect=noise=-35dB:d=0.35", "-f", "null", "-"], { encoding: "utf8" });
  const txt = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const ends = [...txt.matchAll(/silence_end: ([0-9.]+)/g)].map((m) => Number(m[1]));
  if (!ends.length) throw new Error("silencedetect no devolvió ningún onset");
  return ends;
}

(async () => {
  const slug = process.argv[2];
  const apply = process.argv.includes("--apply");
  const s: any = await p.journeyStory.findFirst({ where: { slug }, select: { id: true, text: true, audioUrl: true, audioWordTimings: true, audioFragments: true } });
  const words = s.audioWordTimings.words as Array<{ text: string; startSec: number; endSec: number; charStart: number; charEnd: number }>;
  const frags = (s.audioFragments as Array<{ index: number; text: string; startSec: number; endSec: number }>).filter((f) => f.index > 0);
  const mp3 = Buffer.from(await (await fetch(s.audioUrl)).arrayBuffer());
  const ons = onsets(mp3);

  let pos = 0;
  const cambios: string[] = [];
  for (const f of frags) {
    const i = s.text.indexOf(f.text.slice(0, 18), pos);
    if (i < 0) continue;
    pos = i + 1;
    const fin = pos + f.text.length + 40;
    const mios = words.filter((w) => w.charStart >= i && w.charStart < fin);
    if (mios.length < 3) continue;
    const real = ons.reduce((a, b) => (Math.abs(b - f.startSec) < Math.abs(a - f.startSec) ? b : a));
    const delta = mios[0].startSec - real;
    if (Math.abs(delta) <= TOL) continue;
    // Reescala el párrafo: el arranque va al onset real, el final se queda.
    const a0 = mios[0].startSec, a1 = mios[mios.length - 1].endSec;
    const k = (a1 - real) / (a1 - a0);
    for (const w of mios) {
      w.startSec = +(a1 - (a1 - w.startSec) * k).toFixed(3);
      w.endSec = +(a1 - (a1 - w.endSec) * k).toFixed(3);
    }
    cambios.push(`párrafo ${f.index}: arranque ${a0.toFixed(2)} -> ${real.toFixed(2)}s (iba ${delta > 0 ? "tarde" : "pronto"} ${Math.abs(delta).toFixed(2)}s, factor ${k.toFixed(3)})`);
  }
  console.log(cambios.length ? cambios.join("\n") : "nada que anclar");
  if (!apply) { console.log("\n--apply para escribir"); await p.$disconnect(); return; }
  await p.journeyStory.update({ where: { id: s.id }, data: { audioWordTimings: { ...s.audioWordTimings, words } as never } });
  console.log("escrito");
  await p.$disconnect();
})();
