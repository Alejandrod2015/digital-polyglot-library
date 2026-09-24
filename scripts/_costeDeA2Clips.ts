import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import { practiceVoiceId } from "../src/lib/practiceVoice";
import { isVoiceApproved, APPROVED_VOICES } from "../src/lib/approvedVoices";
const prisma = new PrismaClient();
const JID = "cmubidgaf0007j8np6g7n89iu";
(async () => {
  const st = await prisma.journeyStory.findMany({ where:{journeyId:JID}, select:{ id:true, slug:true, voiceId:true, practiceVoiceId:true, practiceSet:{ select:{ exercises:{ select:{ id:true, type:true, word:true, sentence:true, audioText:true, featured:true, payload:true } } } } }, orderBy:[{topic:"asc"},{slotIndex:"asc"}] });
  const voces = new Map<string, number>();
  let wN=0, wChars=0, sN=0, sChars=0, wFeat=0, sFeat=0;
  const palabras = new Set<string>();
  for (const s of st) {
    let v = "";
    try { v = practiceVoiceId(s as any); } catch { v = "(SIN VOZ)"; }
    voces.set(v, (voces.get(v) ?? 0) + 1);
    for (const e of s.practiceSet?.exercises ?? []) {
      const ac = (e.payload as any)?.audioClip ?? {};
      if (e.type === "meaning_in_context" && !ac.wordClipUrl) {
        wN++; wChars += e.word.trim().replace(/[.?!]+$/,"").length + 1; palabras.add(e.word.trim().toLowerCase());
        if (e.featured !== false) wFeat++;
      }
      if (e.type === "fill_blank" && !ac.clipUrl) {
        const t = (e.audioText ?? e.sentence ?? "").replace(/_+/g, e.word).trim();
        sN++; sChars += t.length + 1;
        if (e.featured !== false) sFeat++;
      }
    }
  }
  console.log("VOCES de practica (= narrador de la historia):");
  for (const [v,n] of voces) console.log(`  ${v}  x${n} historias  aprobada=${isVoiceApproved ? isVoiceApproved(v) : "?"}`);
  console.log(`\npalabras a generar: ${wN} ejercicios (${palabras.size} distintas), ${wChars} chars de texto; featured=${wFeat}`);
  console.log(`frases a generar:   ${sN} ejercicios, ${sChars} chars de texto; featured=${sFeat}`);
  console.log(`TOTAL texto a 1 toma: ${wChars + sChars} chars`);
  console.log(`TECHO a 6 tomas (MAX_TRIES): ${(wChars + sChars) * 6} chars`);
  await prisma.$disconnect();
})();
