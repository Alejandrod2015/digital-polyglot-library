/** Cuelga la MUESTRA (titulo + parrafo 1) en la historia para poder oirla en el
 *  lector. Es una toma PARCIAL: la sustituye el render completo. No toca texto. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const URL = "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/generated/audio/Ya_no_queda_nadie_multivoice_1787513168187.mp3";
(async () => {
  const p = new PrismaClient();
  const r = await p.journeyStory.update({
    where: { id: "cmt5x686y000n320cyme6dmrl" },
    data: { audioUrl: URL, audioSegments: [], audioWordTimings: [], audioStatus: "muestra" },
    select: { slug: true, audioUrl: true },
  });
  console.log(r);
  await p.$disconnect();
})();
