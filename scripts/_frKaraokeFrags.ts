/** ¿Caen las palabras dentro del tramo de audio de su párrafo? Cruza
 *  audioWordTimings con audioFragments (que llevan los tiempos REALES de cada
 *  sección concatenada). Solo lectura. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s: any = await p.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { text: true, audioWordTimings: true, audioFragments: true } });
  const words = (s.audioWordTimings?.words ?? []) as Array<{ text: string; startSec: number; charStart: number }>;
  const frags = (s.audioFragments ?? []) as Array<{ index: number; text: string; startSec: number; endSec: number }>;
  console.log("fragmentos:");
  for (const f of frags) console.log(`  [${f.index}] ${f.startSec.toFixed(2)}-${f.endSec.toFixed(2)}s  ${f.text.slice(0, 58)}`);
  const body = frags.filter((f) => f.index > 0);
  const first = body[0];
  const antes = words.filter((w) => w.startSec < first.startSec);
  console.log(`\npalabras del cuerpo que empiezan ANTES de que acabe el título (${first.startSec.toFixed(2)}s): ${antes.length}`);
  antes.forEach((w) => console.log(`   ${w.text} @ ${w.startSec}s`));
  await p.$disconnect();
})();
