/** Borra DE VERDAD los restos de audio de una historia. Prisma trata
 *  `undefined` como "no toques la columna": para vaciar un Json hay que pasar
 *  `Prisma.DbNull`. Por eso el lector con sesion seguia pintando el karaoke
 *  viejo despues de reescribir el texto. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient, Prisma } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const slug of process.argv.slice(2)) {
    const antes = await p.journeyStory.findFirst({ where: { slug }, select: { id: true, audioUrl: true, audioWordTimings: true, audioSegments: true, audioFragments: true } });
    if (!antes) { console.log(`${slug}: no existe`); continue; }
    const tenia = [antes.audioUrl ? "audioUrl" : null, antes.audioWordTimings ? "wordTimings" : null, antes.audioSegments ? "segments" : null, antes.audioFragments ? "fragments" : null].filter(Boolean);
    await p.journeyStory.update({ where: { id: antes.id }, data: {
      audioUrl: null, audioFilename: null, audioStatus: "pending",
      audioWordTimings: Prisma.DbNull, audioSegments: Prisma.DbNull, audioFragments: Prisma.DbNull,
      audioQaStatus: null, audioQaScore: null, audioQaNotes: null } });
    const d = await p.journeyStory.findFirst({ where: { id: antes.id }, select: { audioWordTimings: true, audioSegments: true, audioFragments: true, audioUrl: true } });
    console.log(`${slug}: tenia [${tenia.join(", ")}] -> ahora url=${d?.audioUrl ?? "null"} timings=${d?.audioWordTimings ?? "null"} segments=${d?.audioSegments ?? "null"} fragments=${d?.audioFragments ?? "null"}`);
  }
  await p.$disconnect();
})();
