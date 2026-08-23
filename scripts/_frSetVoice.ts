/** Fija la voz de narración (y por tanto la de práctica) en las 21 historias
 *  del Expat FR A0. No toca contenido: solo `voiceId`. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertVoiceApproved } from "@/lib/approvedVoices";
const p = new PrismaClient();
const ID = "cmt09ehi60000320qf9efrypu";
const VOICE = "ucMmKRQbfDEYyb2IIGax";   // Aurore
(async () => {
  assertVoiceApproved(VOICE, "narration:expat-fr-a0");
  const apply = process.argv.includes("--apply");
  const st = await p.journeyStory.findMany({ where: { journeyId: ID }, select: { id: true, slug: true, voiceId: true } });
  console.log(`${st.length} historias · ahora con voz: ${st.filter((s) => s.voiceId).length}`);
  if (!apply) { console.log("--apply para escribir"); await p.$disconnect(); return; }
  for (const s of st) await p.journeyStory.update({ where: { id: s.id }, data: { voiceId: `elevenlabs/${VOICE}` } });
  const after = await p.journeyStory.findMany({ where: { journeyId: ID }, select: { voiceId: true } });
  console.log(`escritas: ${after.filter((s) => s.voiceId === `elevenlabs/${VOICE}`).length}/${after.length}`);
  await p.$disconnect();
})();
