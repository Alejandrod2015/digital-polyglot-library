import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { writeFileSync, readFileSync } from "fs";
const p = new PrismaClient();
const ORDEN: Record<string, string[]> = {
  cmt5x67ze000l320cpgunu5vi: ["rooms-and-landlords","jobs-and-wages","meetings-and-deadlines","repeating-and-rephrasing","sayings-and-nicknames","deals-and-estimates","trust-and-rumours"],
  cmtplpfum0007j8c6piegwt31: ["locals-and-outsiders","humour-and-comebacks","rounds-and-regulars","news-and-headlines","wind-and-plans","books-and-bookshops","visits-and-old-friends"],
};
const TAG: Record<string, string> = { cmt5x67ze000l320cpgunu5vi: "b1", cmtplpfum0007j8c6piegwt31: "b2" };
(async () => {
  const cierres = JSON.parse(readFileSync("scripts/tema-cierres.json", "utf8"));
  for (const [jid, topics] of Object.entries(ORDEN)) {
    for (let i = 0; i < topics.length; i++) {
      const t = topics[i];
      const st = await p.journeyStory.findMany({ where: { journeyId: jid, topic: t }, orderBy: { slotIndex: "asc" } });
      const out = st.map((s) => ({ topic: s.topic, slotIndex: s.slotIndex, title: s.title, slug: s.slug, arcType: s.arcType, synopsis: s.synopsis, text: s.text, vocab: s.vocab }));
      writeFileSync(`scripts/_b2s/retit/${TAG[jid]}-t${i + 1}-${t}.json`, JSON.stringify(out, null, 1));
      const plan = cierres[`${jid}#${t}`]?.plan;
      if (!plan) throw new Error(`sin plan: ${jid}#${t}`);
      writeFileSync(`scripts/_b2s/retit/${TAG[jid]}-t${i + 1}-${t}.plan.json`, JSON.stringify(plan, null, 1));
      console.log(TAG[jid], `t${i + 1}`, t, st.length, "historias");
    }
  }
  await p.$disconnect();
})();
