import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

const J = process.env.A2 || "";

// Formas de subjuntivo que aparecen de verdad en textos A2 (presente y pasado).
const SUBJ = /\b(vaya|vayas|vayamos|vayan|sea|seas|seamos|sean|est[eé]|est[eé]s|est[eé]n|tenga|tengas|tengan|tengamos|haga|hagas|hagan|hagamos|pueda|puedas|puedan|podamos|diga|digas|digan|digamos|venga|vengas|vengan|salga|salgas|salgan|quiera|quieras|quieran|sepa|sepas|sepan|d[eé]|den|vea|veas|vean|llegue|llegues|lleguen|pase|pases|pasen|hable|hables|hablen|vuelva|vuelvas|vuelvan|ponga|pongas|pongan|traiga|traigan|siga|sigas|sigan|pida|pidan|deje|dejes|dejen|cierre|cierren|abra|abran|fuera|fueran|tuviera|tuvieran|pudiera|pudieran|hubiera|hubieran|estuviera|estuvieran|dijera|dijeran|hiciera|hicieran|viniera|vinieran)\b/gi;

async function main() {
  const stories = await p.journeyStory.findMany({
    where: { journeyId: J },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { slug: true, title: true, topic: true, slotIndex: true, text: true, vocab: true, audioUrl: true },
  });
  console.log("historias:", stories.length);
  let totalHits = 0, enVocab = 0;
  for (const s of stories) {
    const plain = s.text.replace(/<[^>]+>/g, " ");
    const hits = [...new Set((plain.match(SUBJ) || []).map((w) => w.toLowerCase()))];
    const vocabWords = (s.vocab as any[] || []).map((v) => String(v.word || "").toLowerCase());
    const vocabSubj = vocabWords.filter((w) => SUBJ.test(w) && (SUBJ.lastIndex = 0) === 0);
    if (hits.length || vocabSubj.length) {
      totalHits += hits.length; enVocab += vocabSubj.length;
      console.log(`\n${s.topic} #${s.slotIndex} ${s.audioUrl ? "[AUDIO]" : "[sin audio]"} ${s.slug}`);
      console.log("  texto :", hits.join(", ") || "-");
      if (vocabSubj.length) console.log("  VOCAB :", vocabSubj.join(", "));
      for (const h of hits) {
        const re = new RegExp("[^.!?]*\\b" + h + "\\b[^.!?]*[.!?]", "i");
        const m = plain.match(re);
        if (m) console.log(`    · ${h}: ${m[0].trim()}`);
      }
    }
  }
  console.log(`\nTOTAL formas distintas en texto: ${totalHits} | en vocab curado: ${enVocab}`);
  await p.$disconnect();
}
main();
