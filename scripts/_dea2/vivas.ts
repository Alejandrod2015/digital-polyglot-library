/** SOLO LEE. Por cada palabra: si sigue en el texto (llave del tap) y si sigue
 *  siendo plaza de vocab por lema o superficie (llave del VocabPanel). Las dos
 *  llaves, nunca una sola: borrar mirando solo el texto ya se llevo 57 vivas. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { extractStoryPlainText } from "../../src/lib/storyPlainText";
const p = new PrismaClient();
(async () => {
  const [slug, ...ws] = process.argv.slice(2);
  const s = await p.journeyStory.findFirst({ where: { slug }, select: { title:true, text:true, vocab:true } });
  const texto = `${s!.title}\n${extractStoryPlainText(s!.text ?? "")}`.toLowerCase();
  const voc = ((s!.vocab as any[]) ?? []);
  for (const w of ws) {
    const enTexto = new RegExp(`(?<![\\p{L}\\p{M}])${w}(?![\\p{L}\\p{M}])`, "iu").test(texto);
    const esPlaza = voc.some(v => String(v.word ?? "").toLowerCase().includes(w) || String(v.surface ?? "").toLowerCase() === w);
    console.log(`${w.padEnd(15)} en el texto: ${enTexto ? "SI" : "no"}   plaza de vocab: ${esPlaza ? "SI" : "no"}`);
  }
  await p.$disconnect();
})();
