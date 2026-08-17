import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { isVoiceApproved } from "../src/lib/approvedVoices";
const p = new PrismaClient();

// mismo split dialog-aware del proyecto
const B = /(?<=[.!?…]["'”'»")\]]*)\s+(?=[„«"'"¿¡A-ZÄÖÜÑÀÈÉÌÒÙ0-9])/u;
const nsent = (t: string) => t.trim().split(B).filter((s) => s.trim()).length;
const LANG_DEFAULT: Record<string, string> = { spanish: "yHD4CsKkghm19ToGLJEC", italian: "gfKKsLN1k0oYYN9n2dXX", german: "Ww7Sq9tx9CCOiNOwWgsx" };

async function main() {
  const js = await p.journey.findMany({
    where: { status: "active" },
    select: { name: true, language: true, variant: true,
      stories: { where: { status: "published" }, select: { slug: true, voiceId: true, practiceVoiceId: true,
        practiceSet: { select: { exercises: { select: { type: true, word: true, sentence: true, payload: true } } } } } } },
    orderBy: [{ language: "asc" }, { name: "asc" }],
  });
  for (const j of js) {
    let L = 0, Lempty = 0, Lmulti = 0, Llong = 0, LbadVoice = 0;
    let M = 0, MlongWord = 0, MbadVoice = 0;
    let maxLen = 0;
    for (const s of j.stories) {
      const storyVoice = s.practiceVoiceId?.trim() || s.voiceId || null;
      for (const ex of s.practiceSet?.exercises ?? []) {
        const pl = (ex.payload ?? {}) as any;
        const ac = pl.audioClip as any | undefined;
        if (ex.type === "listen_choose") {
          L++;
          const speech = (ex.sentence?.trim() || ac?.sentence?.trim() || ex.word || "").trim();
          if (!speech) { Lempty++; continue; }
          maxLen = Math.max(maxLen, speech.length);
          if (speech.length > 500) Llong++;
          if (nsent(speech) > 1) Lmulti++;
          // voz que resolvería sentence-tts: audioClip.voiceId si aprobada, si no default idioma
          const v = isVoiceApproved(ac?.voiceId) ? ac.voiceId : LANG_DEFAULT[j.language];
          if (!isVoiceApproved(v)) LbadVoice++;
        }
        if (ex.type === "match_meaning") {
          const pairs = Array.isArray(pl.pairs) ? pl.pairs : [];
          for (const pr of pairs) {
            M++;
            const w = (pr.word ?? "").trim();
            if (!w || w.length > 60) MlongWord++;
            const v = (typeof pr.voiceId === "string" && pr.voiceId) || storyVoice;
            // word-tts: si es genérica/ local la sustituye por aprobada del idioma; comprobamos que la efectiva termine aprobada
            if (!isVoiceApproved(v)) MbadVoice++;
          }
        }
      }
    }
    console.log(`\n${j.name} (${j.language}/${j.variant})`);
    console.log(`  listen=${L}  vacíos=${Lempty}  multi-oración=${Lmulti}  >500ch=${Llong}  voz-no-aprobada=${LbadVoice}  (maxLen=${maxLen})`);
    console.log(`  match-clips=${M}  palabra>60ch=${MlongWord}  voz-no-aprobada=${MbadVoice}`);
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
