/** Vacia el audio de UNA historia para poder retitularla: saveStory --title-only
 *  se niega sobre una historia narrada, y con razon, porque el titulo se oye en
 *  el fragmento 0. Imprime los valores de vuelta atras ANTES de borrarlos.
 *
 *  Uso: npx tsx scripts/_vaciaAudioDeA2.ts <slug> --si */
import "./_loadEnv";
import { PrismaClient, Prisma } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const slug = process.argv[2];
  const s: any = await p.journeyStory.findFirst({ where: { journeyId: "cmubidgaf0007j8np6g7n89iu", slug } });
  if (!s) throw new Error(`no encuentro ${slug}`);
  console.log("VUELTA ATRAS, guarda esto:");
  console.log(JSON.stringify({ id: s.id, audioUrl: s.audioUrl, audioFilename: s.audioFilename, voiceId: s.voiceId, title: s.title }, null, 1));
  if (!process.argv.includes("--si")) { console.log("\nen seco: no se ha tocado nada. Repite con --si."); await p.$disconnect(); return; }
  await p.journeyStory.update({
    where: { id: s.id },
    // Las columnas Json se vacian con Prisma.DbNull. Con `undefined` Prisma
    // entiende "no toques este campo" y las deja intactas, que fue justo el
    // fallo: audioUrl se borraba, audioWordTimings no, y --title-only seguia
    // negandose porque mira los dos.
    data: { audioUrl: null, audioFilename: null,
            audioSegments: Prisma.DbNull, audioFragments: Prisma.DbNull, audioWordTimings: Prisma.DbNull,
            audioStatus: "pending", audioQaStatus: null, audioQaScore: null, audioQaNotes: null },
  });
  console.log(`\n${slug}: audio vaciado.`);
  await p.$disconnect();
})();
