/** Cuota de plazas por encima de A1/A2, por journey y por historia. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
const p = new PrismaClient();
(async () => {
  for (const [jid, tag] of [["cmt5x67ze000l320cpgunu5vi", "B1"], ["cmtplpfum0007j8c6piegwt31", "B2"]] as [string, string][]) {
    const st = await p.journeyStory.findMany({ where: { journeyId: jid }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { slug: true, topic: true, slotIndex: true, vocab: true } });
    let tot = 0, alto = 0;
    for (const s of st) {
      const v = (s.vocab as any[]) ?? [];
      const bajas = v.filter((x) => isSpanishUpToLevel(String(x.word), "a2")).map((x) => x.word);
      tot += v.length; alto += v.length - bajas.length;
      console.log(`${tag} ${s.topic.padEnd(24)}#${s.slotIndex} ${String(v.length - bajas.length).padStart(2)}/${v.length} · A1A2: ${bajas.join(", ")}`);
    }
    console.log(`### ${tag}: ${alto}/${tot} = ${Math.round((alto / tot) * 100)}% (suelo 60%) · faltan ${Math.max(0, Math.ceil(0.6 * tot) - alto)} plazas\n`);
  }
  await p.$disconnect();
})();
