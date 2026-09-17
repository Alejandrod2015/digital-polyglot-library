/** Vuelca un tema entero (3 historias) con todos los campos que pide saveStory.ts:
 *  npx tsx scripts/_b2/_dumpTemaFull.ts <tema> <fichero.json> */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [tema, fichero] = process.argv.slice(2);
  const hs = await p.journeyStory.findMany({
    where: { journeyId: "cmtpls1l20007j8epwgcs6e1h", topic: tema },
    select: { slug: true, title: true, synopsis: true, text: true, vocab: true, arcType: true, topic: true, slotIndex: true },
    orderBy: { slotIndex: "asc" },
  });
  if (hs.length !== 3) throw new Error(`esperaba 3, hay ${hs.length}`);
  fs.writeFileSync(fichero, JSON.stringify(hs, null, 2));
  console.log(`escrito ${fichero}: ${hs.map(h=>h.slug).join(", ")}`);
  await p.$disconnect();
})();
