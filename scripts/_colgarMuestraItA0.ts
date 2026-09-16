// Cuelga temporalmente la muestra de voz en la fila de la historia para
// poder oirla EN el lector (con su texto, karaoke y pildoras de vocab), tal
// como exige el hook stop-story-audio-link-guard.sh. Se retira con
// _clearStaleAudio.ts + _dropFragments.ts antes del render completo.
// Solo toca audioUrl (media-only, no pasa por saveStory.ts).
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
import * as path from "path";
const p = new PrismaClient();
async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("uso: _colgarMuestraItA0.ts <slug>");
  const reg = JSON.parse(fs.readFileSync(path.join(__dirname, "a2-muestras.json"), "utf8"));
  const entry = reg[slug];
  if (!entry) throw new Error(`no hay muestra registrada para ${slug}`);
  const story = await p.journeyStory.findFirst({
    where: { journeyId: "cmu0dpa3i0007j80ugstn0jf0", slug },
    select: { id: true, audioUrl: true },
  });
  if (!story) throw new Error(`historia ${slug} no encontrada`);
  if (story.audioUrl) throw new Error(`${slug} ya tiene audioUrl; no piso nada`);
  await p.journeyStory.update({ where: { id: story.id }, data: { audioUrl: entry.url } });
  console.log(`colgado: ${slug} -> ${entry.url}`);
}
main().finally(() => p.$disconnect());
