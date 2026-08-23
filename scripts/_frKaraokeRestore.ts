/** Devuelve los tiempos de karaoke tal y como los dejó el alineador, desde un
 *  volcado de `_dumpTimings.ts`. Existe porque el anclaje por párrafo arregló
 *  los arranques y estropeó los interiores (27 -> 43 palabras encendidas sobre
 *  silencio): se mide, y si sale peor, se deshace. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { readFileSync } from "fs";
const p = new PrismaClient();
(async () => {
  const [dump, slug] = process.argv.slice(2);
  const d = JSON.parse(readFileSync(dump, "utf8"));
  const s: any = await p.journeyStory.findFirst({ where: { slug }, select: { id: true, audioWordTimings: true } });
  await p.journeyStory.update({ where: { id: s.id }, data: { audioWordTimings: { ...s.audioWordTimings, words: d.words } as never } });
  console.log(`restauradas ${d.words.length} palabras en ${slug}`);
  await p.$disconnect();
})();
