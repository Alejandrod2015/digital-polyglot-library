/** "le juin" no existe en francés: los meses no llevan artículo así. La plaza
 *  pasa a `juin`, que es la forma de diccionario que ve el alumno. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
(async () => {
  const r: any = await p.journeyStory.findFirst({
    where: { journeyId: "cmt09ehi60000320qf9efrypu", slug: "la-question-de-baptiste" },
    select: { topic: true, slotIndex: true, title: true, slug: true, synopsis: true, text: true, vocab: true, arcType: true },
  });
  const vocab = (r.vocab as any[]).map((v) => (String(v.word) === "le juin"
    ? { ...v, word: "juin", surface: "juin", definition: "June, the sixth month of the year" } : v));
  fs.writeFileSync(process.argv[2], JSON.stringify([{ ...r, vocab }], null, 2));
  console.log("payload escrito");
  await p.$disconnect();
})();
