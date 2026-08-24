/** Escribe el `dialogueSpec` de las 21 del Traveler ES latam A1: UN solo
 *  segmento con `speaker: "narrator"` y la voz del pais, que es la forma exacta
 *  del A0 latam publicado (21 de 21 asi). Las historias son prosa narrada con
 *  habla citada entre comillas curvas, no bloques `Personaje: linea`, asi que
 *  `countStorySpeakers` da 1 en las 21 y la voz unica es lo correcto.
 *  No sintetiza nada. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: A1 },
    select: { id: true, slug: true, text: true, voiceId: true, dialogueSpec: true } });
  let n = 0;
  for (const s of st) {
    if (!s.voiceId) { console.error(`${s.slug}: sin voiceId`); process.exit(1); }
    await p.journeyStory.update({ where: { id: s.id },
      data: { dialogueSpec: [{ text: String(s.text), voice: s.voiceId, speaker: "narrator" }] as never } });
    n++;
  }
  console.log(`${n} dialogueSpec escritos.`);
  await p.$disconnect();
})();
