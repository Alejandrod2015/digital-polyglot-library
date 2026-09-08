import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { writeFileSync } from "fs";
const p = new PrismaClient();
(async () => {
  const temas: [string, string, string][] = [
    ["cmt5x67ze000l320cpgunu5vi", "rooms-and-landlords", "b1-t1"],
    ["cmt5x67ze000l320cpgunu5vi", "meetings-and-deadlines", "b1-t3"],
    ["cmt5x67ze000l320cpgunu5vi", "sayings-and-nicknames", "b1-t5"],
  ];
  for (const [jid, t, tag] of temas) {
    const st = await p.journeyStory.findMany({ where: { journeyId: jid, topic: t }, orderBy: { slotIndex: "asc" } });
    writeFileSync(`scripts/_b2s/retit/orig/${tag}.json`, JSON.stringify(st.map((s) => ({ topic: s.topic, slotIndex: s.slotIndex, title: s.title, slug: s.slug, arcType: s.arcType, synopsis: s.synopsis, text: s.text, vocab: s.vocab })), null, 1));
  }
  await p.$disconnect();
})();
