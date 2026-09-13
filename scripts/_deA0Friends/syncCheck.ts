import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { readFileSync } from "fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (let t = 1; t <= 7; t++) {
    const local = JSON.parse(readFileSync(`scripts/_deA0Friends/t${t}-data.json`, "utf8"));
    for (const d of local) {
      const row = await p.journeyStory.findFirst({ where: { journeyId: "cmu047bkz0007326jsgeptkox", topic: d.topic, slotIndex: d.slotIndex }, select: { text: true, vocab: true } });
      const same = row && row.text === d.text && JSON.stringify((row.vocab as any[]).map((v:any)=>[v.word,v.surface,!!v.anchor])) === JSON.stringify(d.vocab.map((v:any)=>[v.word,v.surface,!!v.anchor]));
      if (!same) console.log("DIFIERE", t, d.slotIndex, row?.text === d.text ? "(solo vocab)" : "(texto)");
    }
  }
  await p.$disconnect();
})();
