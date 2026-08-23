/** Deja la historia lista para el render completo: fija el dialogueSpec (Maia,
 *  la voz del A1 que este journey continua) y quita la URL de la MUESTRA para
 *  que el script canonico no aborte por "ya tiene audioUrl". */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const r = await p.journeyStory.update({
    where: { id: "cmt5x686y000n320cyme6dmrl" },
    data: {
      dialogueSpec: [{ voice: "jipeLrCHZ6ByxrU2JP9i", speaker: "narrator" }],
      audioUrl: null, audioFilename: null, audioSegments: [], audioFragments: [], audioStatus: "pending",
    },
    select: { slug: true, dialogueSpec: true, audioUrl: true },
  });
  console.log(r);
  await p.$disconnect();
})();
