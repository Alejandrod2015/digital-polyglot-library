/**
 * Alinea el karaoke PÁRRAFO A PÁRRAFO, contra el mp3 de cada sección, en vez de
 * mandar la historia entera con el título pegado delante.
 *
 * WHY (2026-08-23, Expat FR A0): en "Les premières heures" el alineador metió
 * las dos primeras palabras del cuerpo DENTRO del título: el resaltado encendía
 * "Manon est" mientras la narradora aún decía el título, y luego había un
 * segundo de silencio digital puro. Medido con el perfil de energía del wav:
 * título 0,1-0,95 s, silencio 1,0-2,05 s, cuerpo desde 2,10 s; los tiempos
 * guardados decían 0,20 s y 0,80 s. Otros dos párrafos arrancaban 0,6 y 0,8 s
 * antes de tiempo.
 *
 * Anclar a posteriori NO sirve (se probó): arreglaba los arranques y descolocaba
 * los interiores, de 27 a 43 palabras encendidas sobre silencio. La cura es no
 * crear el problema: cada sección ya tiene su propio audio y su offset exacto,
 * así que se alinea sola y se desplaza por construcción.
 *
 *   npx tsx scripts/_frKaraokeByFragment.ts <slug> [--apply]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { alignAudioOnModal, extractStoryPlainText } from "../src/lib/alignStoryAudio";

const p = new PrismaClient();

type Frag = { index: number; text: string; url: string | null; startSec: number; endSec: number };
type Word = { text: string; charStart: number; charEnd: number; startSec: number; endSec: number };

(async () => {
  const slug = process.argv[2];
  const apply = process.argv.includes("--apply");
  const s: any = await p.journeyStory.findFirst({
    where: { slug },
    select: { id: true, text: true, audioWordTimings: true, audioFragments: true, journey: { select: { language: true } } },
  });
  if (!s) throw new Error(`no existe ${slug}`);

  const plain = extractStoryPlainText(s.text);
  const frags = (s.audioFragments as Frag[]).filter((f) => f.index > 0 && f.url);

  const words: Word[] = [];
  let cursor = 0;
  for (const f of frags) {
    const fragPlain = extractStoryPlainText(f.text);
    // Dónde vive este párrafo dentro del texto plano, para que los char offsets
    // sigan cayendo sobre la palabra que el lector pinta.
    const at = plain.indexOf(fragPlain.slice(0, 24), cursor);
    if (at < 0) throw new Error(`párrafo ${f.index} no encontrado en el cuerpo`);
    cursor = at + 1;

    const { tokens } = await alignAudioOnModal({
      audioUrl: f.url!,
      plainText: fragPlain,
      language: s.journey.language,
    });
    if (!tokens.length) throw new Error(`párrafo ${f.index}: el alineador no devolvió tokens`);

    for (const t of tokens) {
      words.push({
        text: t.text,
        charStart: t.charStart + at,
        charEnd: t.charEnd + at,
        startSec: +(t.startSec + f.startSec).toFixed(3),
        endSec: +(t.endSec + f.startSec).toFixed(3),
      });
    }
    console.log(`  párrafo ${f.index}: ${tokens.length} palabras, ${f.startSec.toFixed(2)}s + [${tokens[0].startSec.toFixed(2)}..${tokens[tokens.length - 1].endSec.toFixed(2)}]`);
  }

  // Comprobación barata de que los char offsets siguen apuntando bien.
  const malColocadas = words.filter((w) => plain.slice(w.charStart, w.charEnd) !== w.text).length;
  console.log(`\n${words.length} palabras · ${malColocadas} con char offset que no casa`);
  if (malColocadas > words.length * 0.02) throw new Error("demasiados offsets descolocados, no escribo");

  if (!apply) { console.log("--apply para escribir"); await p.$disconnect(); return; }
  await p.journeyStory.update({
    where: { id: s.id },
    data: { audioWordTimings: { ...(s.audioWordTimings ?? {}), words } as never },
  });
  console.log("escrito");
  await p.$disconnect();
})();
