import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { fueraDelLexico as fdl } from "../_utilidadVocab";
import { esHuecoDelLexico } from "../../src/lib/cefr/spanishLexiconGaps";
const fueraDelLexico = (w: string) => fdl(w) && !esHuecoDelLexico(w);
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { slug: true, topic: true, slotIndex: true, vocab: true },
  });
  let total = 0;
  for (const r of rows) {
    const fuera = ((r.vocab ?? []) as any[]).filter((v) => fueraDelLexico(String(v.word)));
    if (!fuera.length) continue;
    total += fuera.length;
    console.log(`${r.topic}#${r.slotIndex} ${r.slug}`);
    for (const v of fuera) console.log(`   ${v.word} [${v.type}${v.anchor ? " ANCHOR" : ""}${v.register ? " " + v.register : ""}] surface=${v.surface ?? ""}`);
  }
  console.log(`TOTAL fuera: ${total} · media ${(total/rows.length).toFixed(2)} · tope 1,5 => max 31`);
  await p.$disconnect();
})();
