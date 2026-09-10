/**
 * SOLO LECTURA. Vuelca las 21 historias del Traveler PT-BR B1
 * (cmtrcpgso00073232h8vaf7na) con su texto y su vocab, para autorar los sets
 * de practica. Escribe un JSON en la ruta que se le pase.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
async function main() {
  const out = process.argv[2];
  const st = await p.journeyStory.findMany({
    where: { journeyId: "cmtrcpgso00073232h8vaf7na", NOT: { text: null } },
    select: { slug: true, title: true, text: true, vocab: true, slotIndex: true, topic: true },
    orderBy: { slotIndex: "asc" },
  });
  fs.writeFileSync(out, JSON.stringify(st, null, 1));
  console.log(`${st.length} historias -> ${out}`);
}
main().catch((e) => console.error(String(e).slice(0, 800))).finally(() => p.$disconnect());
