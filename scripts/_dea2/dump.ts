import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const JID = "cmubidgaf0007j8np6g7n89iu";
const TOPICS = ["flats-and-viewings","moving-and-helping-out","second-hand-and-bargains","job-hunting-and-interviews","sports-and-match-days","illness-and-sick-days","housewarming-and-toasts"];
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: JID },
    select: { id:true, topic:true, slotIndex:true, slug:true, title:true, text:true, synopsis:true, vocab:true, cast:true } });
  st.sort((a,b)=> TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic) || a.slotIndex-b.slotIndex);
  fs.writeFileSync("scripts/_deA2/stories.json", JSON.stringify(st, null, 1));
  let out = "";
  for (const s of st) {
    out += `\n===== ${s.topic} #${s.slotIndex} · ${s.slug} =====\n# ${s.title}\n${s.text}\n--- VOCAB ---\n`;
    for (const v of (s.vocab as any[])) out += `${v.word} | ${v.type}${v.register?" ["+v.register+"]":""} | ${v.definition ?? v.gloss ?? ""}\n`;
    out += `--- CAST ---\n${JSON.stringify(s.cast)}\n`;
  }
  fs.writeFileSync("scripts/_deA2/stories.txt", out);
  console.log("ok", st.length);
  await p.$disconnect();
})();
