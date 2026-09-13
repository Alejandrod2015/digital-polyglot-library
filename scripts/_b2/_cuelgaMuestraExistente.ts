/** Cuelga en la fila de la historia una muestra que YA se generó y subió, sin
 *  sintetizar nada nuevo. Solo escribe audioUrl/audioStatus.
 *    npx tsx scripts/_b2/_cuelgaMuestraExistente.ts <slug> <url> */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [slug, url] = process.argv.slice(2);
  const s = await p.journeyStory.findFirst({ where: { slug }, select: { id: true, audioUrl: true } });
  if (!s) throw new Error(`no encuentro ${slug}`);
  if (s.audioUrl) throw new Error(`${slug} ya tiene audio; retira con _clearStaleAudio.ts antes`);
  await p.journeyStory.update({ where: { id: s.id }, data: { audioUrl: url, audioStatus: "ready" } });
  console.log(`colgada: /stories/${slug}`);
  await p.$disconnect();
})();
