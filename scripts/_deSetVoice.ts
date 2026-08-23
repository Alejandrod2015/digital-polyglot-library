/**
 * Casting del Traveler DE A0: la MISMA voz alemana que ya narra Expat DE C1 y
 * Friends DE C1 en produccion (`Ww7Sq9tx9CCOiNOwWgsx`), que ya esta en la
 * allowlist de voces aprobadas. No se busca ni se aprueba ninguna voz nueva.
 * El Expat DE usa esa misma voz tambien para la practica; se copia el
 * precedente. Escribe solo `voiceId` y `practiceVoiceId`, nunca contenido.
 *
 *   npx tsx scripts/_deSetVoice.ts [--apply]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { isVoiceApproved } from "../src/lib/approvedVoices";

const JID = "cmt0a8vb1000m32p1x7r5ba28";
const VOZ = "Ww7Sq9tx9CCOiNOwWgsx";
const prisma = new PrismaClient();

(async () => {
  if (!isVoiceApproved(VOZ)) throw new Error(`${VOZ} no esta en la allowlist; no se casta nada.`);
  const apply = process.argv.includes("--apply");
  const st = await prisma.journeyStory.findMany({
    where: { journeyId: JID },
    select: { id: true, slug: true, voiceId: true, practiceVoiceId: true, audioUrl: true },
  });
  const conAudio = st.filter((s) => s.audioUrl);
  if (conAudio.length) {
    // Cambiar la voz de una historia YA renderizada deja el mp3 y el nuevo
    // voiceId contando cosas distintas; si algun dia las hay, se para.
    console.log(`PARA: ${conAudio.length} historias ya tienen audio renderizado.`);
    return;
  }
  const faltan = st.filter((s) => s.voiceId !== VOZ || s.practiceVoiceId !== VOZ);
  console.log(`${faltan.length}/${st.length} historias sin la voz puesta`);
  if (!apply) { console.log("--apply para escribir"); return; }
  const r = await prisma.journeyStory.updateMany({
    where: { journeyId: JID },
    data: { voiceId: VOZ, practiceVoiceId: VOZ },
  });
  console.log(`voiceId y practiceVoiceId = ${VOZ} en ${r.count} historias`);
})().finally(() => prisma.$disconnect());
