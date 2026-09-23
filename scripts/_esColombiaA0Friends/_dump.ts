import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import fs from "node:fs";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmue7cgmf0007j8p6sh7f7xrh" }, select: { topics: true, stories: { orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { id:true, slug:true, title:true, text:true, vocab:true, topic:true, slotIndex:true, status:true, cast:true, synopsis:true, arcType:true, audioUrl:true } } } });
  fs.writeFileSync("scripts/_esColombiaA0Friends/historias.json", JSON.stringify(j, null, 1));
  console.log("topics:", j!.topics.join(", "));
  for (const s of j!.stories) console.log(s.topic, s.slotIndex, s.slug, "|", s.title, "|", (s.text||"").length, "chars |", Array.isArray(s.vocab)?s.vocab.length:"?", "vocab | audio:", s.audioUrl?"si":"no");
  await p.$disconnect();
})();
