import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertVoiceApproved } from "../src/lib/approvedVoices";
// Violetta, la MISMA narradora del Traveler IT A0 publicado, que es el journey
// que este continua. No se elige voz nueva: la escalera de un journey al
// siguiente se rompe si cambia la voz a mitad.
const VOZ = "gfKKsLN1k0oYYN9n2dXX";
const p = new PrismaClient();
(async () => {
  assertVoiceApproved(VOZ, "it-a1:narrador");
  const slug = process.argv[2];
  const r = await p.journeyStory.updateMany({
    where: { journeyId: "cmt5wqsf7000032ghesowd0jy", ...(slug ? { slug } : {}) },
    data: { voiceId: VOZ },
  });
  console.log(`voiceId puesto en ${r.count} historia(s)`);
  await p.$disconnect();
})();
