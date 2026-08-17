/**
 * Re-alinea el karaoke de las historias cuyo máster cambió de duración tras
 * re-tirar un fragmento (`_rerollSection.ts` avisa: audioWordTimings y
 * audioSegments quedan desfasados).
 *
 * Llama a `generateWordTimingsForStory`, exactamente la misma función que ya
 * corre el generador canónico `_genA1SpainStoryAudio.ts` al terminar el
 * render. NO escribe contenido de la historia: la función solo toca
 * `audioWordTimings` y `audioSegments`.
 *
 *   npx tsx scripts/_realignA1Neighbours.ts <slug> [<slug>...]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";

const prisma = new PrismaClient();

void (async () => {
  const slugs = process.argv.slice(2);
  if (!slugs.length) { console.error("uso: _realignA1Neighbours.ts <slug>..."); process.exit(1); }
  for (const slug of slugs) {
    const story = await prisma.journeyStory.findFirst({ where: { slug }, select: { id: true } });
    if (!story) { console.log(`!! ${slug}: no existe`); continue; }
    try {
      await generateWordTimingsForStory(story.id);
      console.log(`ok ${slug}`);
    } catch (e) {
      console.log(`FALLO ${slug}: ${(e as Error).message?.slice(0, 140)}`);
    }
  }
  await prisma.$disconnect();
})();
