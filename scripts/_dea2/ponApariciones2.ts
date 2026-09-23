/** Anade a `cs` un trozo escrito a mano por cada aparicion que no cubria
 *  ninguno de los ya traducidos. Aditivo: `c` no se toca. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { extractStoryPlainText } from "../../src/lib/storyPlainText";
import { chunkCoversTap } from "../../src/lib/tapGlossChunk";
const BUNDLE = "german-friends-a2";
const p = new PrismaClient();
(async () => {
  const datos = JSON.parse(fs.readFileSync("scripts/_deA2/apariciones2.json", "utf8")) as Record<string, Record<string, {es:string;en:string}>>;
  let n = 0;
  for (const [slug, ws] of Object.entries(datos)) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: BUNDLE, slug } } });
    const capa = fila!.glosses as Record<string, any>;
    const st = await p.journeyStory.findFirst({ where: { slug }, select: { title:true, text:true } });
    const texto = `${st!.title}\n${extractStoryPlainText(st!.text ?? "")}`;
    for (const [w, c] of Object.entries(ws)) {
      if (!chunkCoversTap(c.es, texto)) { console.error(`${slug}/${w}: "${c.es}" no esta literal`); process.exit(1); }
      if (!capa[w]) { console.error(`${slug}/${w}: no esta en la capa`); process.exit(1); }
      capa[w].cs = [...(capa[w].cs ?? []), c]; n++;
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: BUNDLE, slug } }, data: { glosses: capa as never } });
  }
  console.log(`${n} trozos de aparicion escritos a mano`);
  await p.$disconnect();
})();
