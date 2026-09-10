// Scratch: pone a Maia como narradora unica en las historias del Traveler ES B1 que aun
// no tienen voz, igual que el A1 y el A2 de Espana. Solo voiceId y dialogueSpec: ni texto
// ni vocab. No sintetiza nada.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { assertVoiceApproved } from "../../src/lib/approvedVoices";
import { assertNarradorPermitido } from "../../src/lib/bannedNarrators";

const J = "cmt5x67ze000l320cpgunu5vi";
const MAIA = "jipeLrCHZ6ByxrU2JP9i";
(async () => {
  assertVoiceApproved(MAIA, "narration:traveler-es-spain-b1");
  assertNarradorPermitido(MAIA, "traveler-es-spain-b1");
  console.log("assertVoiceApproved y assertNarradorPermitido: ok para", MAIA);
  const p = new PrismaClient();
  const spec = [{ voice: MAIA, speaker: "narrator" }];
  const r = await p.journeyStory.updateMany({
    where: { journeyId: J, voiceId: null, audioUrl: null },
    data: { voiceId: MAIA, dialogueSpec: spec },
  });
  console.log("historias actualizadas:", r.count);
  const ss = await p.journeyStory.findMany({ where: { journeyId: J }, select: { voiceId: true, dialogueSpec: true, audioUrl: true } });
  const conMaia = ss.filter((s) => s.voiceId === MAIA && JSON.stringify(s.dialogueSpec) === JSON.stringify(spec)).length;
  console.log(`relectura: ${conMaia}/${ss.length} con Maia (voiceId + dialogueSpec) · audioUrl ${ss.filter((s) => s.audioUrl).length}`);
  await p.$disconnect();
})();
