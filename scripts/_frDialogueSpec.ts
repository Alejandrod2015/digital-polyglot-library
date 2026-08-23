/** Deja el `dialogueSpec` de las 21 del Expat FR A0 con un solo segmento de
 *  narradora (Aurore), que es lo que lee el generador de narracion. No toca
 *  contenido: ni texto, ni vocab, ni titulo. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertVoiceApproved } from "@/lib/approvedVoices";
const p = new PrismaClient();
const ID = "cmt09ehi60000320qf9efrypu";
const VOICE = "ucMmKRQbfDEYyb2IIGax";
(async () => {
  assertVoiceApproved(VOICE, "fr-a0:dialogueSpec");
  const apply = process.argv.includes("--apply");
  const st = await p.journeyStory.findMany({ where: { journeyId: ID }, select: { id: true, slug: true, dialogueSpec: true, audioUrl: true } });
  console.log(`${st.length} historias · con dialogueSpec: ${st.filter((s) => s.dialogueSpec).length} · con audio: ${st.filter((s) => s.audioUrl).length}`);
  if (!apply) { console.log("--apply para escribir"); await p.$disconnect(); return; }
  for (const s of st) await p.journeyStory.update({ where: { id: s.id }, data: { dialogueSpec: [{ speaker: "narrator", voice: VOICE }] as never } });
  console.log("dialogueSpec puesto en las 21");
  await p.$disconnect();
})();
