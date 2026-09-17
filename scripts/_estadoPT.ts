/** Estado de los dos journeys de portugues antes de retitular 42 historias.
 *
 *  Lo que decide si esto es seguro: si estan publicados, y si alguna historia
 *  lleva audio. Cambiar el titulo de una historia narrada desincroniza el
 *  karaoke, porque el lector pinta desde una COPIA del texto guardada al
 *  alinear. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const IDS = ["cmtrcpgso00073232h8vaf7na", "cmtq5n9a50007j8812p9lzxjr"];

(async () => {
  for (const id of IDS) {
    const j = await p.journey.findFirst({
      where: { id }, select: { id: true, name: true, status: true, language: true, levels: true },
    });
    const hs = await p.journeyStory.findMany({
      where: { journeyId: id }, select: { slug: true, audioUrl: true },
    });
    const conAudio = hs.filter((h) => h.audioUrl);
    
    console.log(`\n${j?.id}  ${j?.language} ${JSON.stringify(j?.levels)}  status=${j?.status}  "${j?.name}"`);
    console.log(`  ${hs.length} historias · ${conAudio.length} con audio`);
    if (conAudio.length) console.log(`  CON AUDIO: ${conAudio.map((h) => h.slug).join(", ")}`);
  }
  await p.$disconnect();
})();
