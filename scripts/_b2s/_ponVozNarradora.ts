/** Pone la narradora (Maia) en las 21 historias del Traveler ES/spain B2, por el mismo camino que los
 *  Traveler A1 y A2 de España: `voiceId` con el id pelado. No toca texto, vocab, dialogueSpec ni practica.
 *  Sin --apply solo comprueba. Para en seco si el estado no es el declarado. No genera audio. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { assertVoiceApproved } from "../../src/lib/approvedVoices";
import { assertNarradorPermitido } from "../../src/lib/bannedNarrators";
const p = new PrismaClient();
const J = "cmtplpfum0007j8c6piegwt31";
const MAIA = "jipeLrCHZ6ByxrU2JP9i";
(async () => {
  assertVoiceApproved(MAIA, "narration:traveler-es-spain-b2");
  assertNarradorPermitido(MAIA, "narration:traveler-es-spain-b2");
  console.log("voz: approvedVoices ok · bannedNarrators ok");
  const j = await p.journey.findUnique({ where: { id: J }, select: { status: true, language: true, variant: true } });
  const st = await p.journeyStory.findMany({ where: { journeyId: J }, select: { id: true, slug: true, voiceId: true, cast: true, audioUrl: true, dialogueSpec: true } });
  const mal: string[] = [];
  if (j?.status !== "draft" || j.language !== "spanish" || j.variant !== "spain") mal.push(`journey ${JSON.stringify(j)}`);
  if (st.length !== 21) mal.push(`${st.length} historias`);
  for (const s of st) {
    if (s.audioUrl) mal.push(`${s.slug}: tiene audioUrl`);
    if (s.voiceId) mal.push(`${s.slug}: ya tiene voiceId ${s.voiceId}`);
    if (s.cast) mal.push(`${s.slug}: tiene cast`);
    if (s.dialogueSpec) mal.push(`${s.slug}: tiene dialogueSpec`);
  }
  if (mal.length) { console.error("ESTADO DISTINTO DEL DECLARADO, no escribo:\n  " + mal.join("\n  ")); await p.$disconnect(); process.exit(1); }
  console.log(`estado declarado: draft · ${st.length} historias · 0 audioUrl · 0 voiceId · 0 cast · 0 dialogueSpec`);
  if (!process.argv.includes("--apply")) { console.log("(sin --apply: no escribo)"); await p.$disconnect(); return; }
  for (const s of st) await p.journeyStory.update({ where: { id: s.id }, data: { voiceId: MAIA } });
  const after = await p.journeyStory.findMany({ where: { journeyId: J }, select: { voiceId: true, audioUrl: true } });
  console.log(`escritas: ${after.filter((s) => s.voiceId === MAIA).length}/${after.length} con Maia · audioUrl ${after.filter((s) => s.audioUrl).length}`);
  await p.$disconnect();
})();
