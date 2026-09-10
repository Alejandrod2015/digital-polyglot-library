/** SOLO LECTURA. Vuelca en formato saveStory las 3 historias del tema de
 *  nada-minha-filha (journey cmtrcpgso00073232h8vaf7na) y el mapa slug->tema. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const J = "cmtrcpgso00073232h8vaf7na";
  const all = await p.journeyStory.findMany({ where: { journeyId: J }, select: { slug: true, topic: true, slotIndex: true }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
  for (const s of all) console.log(`${s.topic}\t${s.slotIndex}\t${s.slug}`);
  const topic = all.find((s) => s.slug === "nada-minha-filha")!.topic;
  const st = await p.journeyStory.findMany({ where: { journeyId: J, topic }, select: { topic: true, slotIndex: true, title: true, slug: true, synopsis: true, text: true, vocab: true, arcType: true }, orderBy: { slotIndex: "asc" } });
  fs.writeFileSync(process.argv[2], JSON.stringify(st, null, 1));
  console.log(`tema ${topic}: ${st.length} -> ${process.argv[2]}`);
})().finally(() => p.$disconnect());
