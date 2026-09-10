/** Vuelca un tema en la forma que come saveStory, con el titulo de hoy, para
 *  retitular sin tocar nada mas.
 *
 *  Se manda la historia COMPLETA aunque `--title-only` solo cambie el titulo:
 *  asi el validador canonico juzga el titulo nuevo contra el cuerpo real, y de
 *  paso el propio modo comprueba que texto, sinopsis, vocab, arco y slug
 *  llegan identicos a lo que hay en la base. Es la red que evita que un
 *  retitulado se lleve por delante un cuerpo.
 *
 *  Uso: _temaPT.ts <journeyId> <topic> [--cuerpos]  */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

(async () => {
  const [journeyId, topic] = process.argv.slice(2);
  const cuerpos = process.argv.includes("--cuerpos");
  const hs = await p.journeyStory.findMany({
    where: { journeyId, topic },
    select: { slug: true, topic: true, slotIndex: true, title: true, synopsis: true, text: true, vocab: true, arcType: true },
    orderBy: { slotIndex: "asc" },
  });
  if (!hs.length) { console.error(`sin historias en ${topic}`); process.exit(1); }

  const fichero = `scripts/_ptTitulos/${topic}.json`;
  fs.mkdirSync("scripts/_ptTitulos", { recursive: true });
  fs.writeFileSync(fichero, `${JSON.stringify(hs, null, 2)}\n`);
  console.log(`${fichero}  (${hs.length} historias)`);
  for (const h of hs) {
    console.log(`\n───── slot ${h.slotIndex}  ${h.slug}\nHOY: ${h.title}  (${(h.title ?? "").length})`);
    if (cuerpos) console.log(`${h.text}`);
  }
  await p.$disconnect();
})();
