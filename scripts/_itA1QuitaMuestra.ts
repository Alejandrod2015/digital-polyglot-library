import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
// Retira la MUESTRA de la fila para que el render completo no aborte. No borra
// nada en R2: el mp3 de review sigue donde estaba y la cache de segmentos, que
// es lo que ahorra creditos, no se toca.
const p = new PrismaClient();
(async () => {
  const slug = process.argv[2];
  const r = await p.journeyStory.updateMany({
    where: { slug, journeyId: "cmt5wqsf7000032ghesowd0jy" },
    data: { audioUrl: null, audioFilename: null, audioStatus: "pending", audioFragments: undefined, audioSegments: undefined, audioWordTimings: undefined },
  });
  console.log(`muestra retirada de ${r.count} fila(s)`);
  await p.$disconnect();
})();
