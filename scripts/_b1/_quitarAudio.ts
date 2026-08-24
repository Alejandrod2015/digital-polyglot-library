/** El texto de `ya-no-queda-nadie` cambio en tres parrafos, asi que 3 de sus 5
 *  fragmentos dicen otra cosa que el texto. Un mp3 que no coincide con lo que
 *  se lee es peor que no tener audio, asi que se quita. La toma aprobada del
 *  titulo y del primer parrafo NO se pierde: la cache es por contenido y el
 *  render completo la reutiliza sin gastar creditos. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const r = await p.journeyStory.updateMany({
    where: { journeyId: "cmt5x67ze000l320cpgunu5vi", slug: "ya-no-queda-nadie" },
    data: { audioUrl: null, audioFilename: null, audioSegments: [], audioFragments: [],
            audioWordTimings: [], audioStatus: "pending" },
  });
  console.log("historias sin audio ahora:", r.count);
  await p.$disconnect();
})();
