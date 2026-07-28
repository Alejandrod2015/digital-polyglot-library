/**
 * Realinea una historia quitando del texto de alineacion las acotaciones entre
 * parentesis ("(riendo suavemente)"), que se imprimen pero el narrador puede no
 * leer. Si aeneas les reserva tiempo, empuja tarde todo lo que viene despues.
 *
 * Deja las dos versiones en disco para medirlas con la misma regla.
 * Read-only: no escribe en la base.
 *
 *   npx tsx scripts/_karaokeAcotTest.ts <outDir> --slug a,b
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { alignStoryAudio } from "../src/lib/alignStoryAudio";

const prisma = new PrismaClient();

async function main() {
  const outDir = process.argv[2];
  const i = process.argv.indexOf("--slug");
  const slugs = process.argv[i + 1].split(",");
  mkdirSync(outDir, { recursive: true });

  for (const slug of slugs) {
    const story = await prisma.catalogStory.findFirst({
      where: { slug },
      select: { id: true, title: true, text: true, audio: true, audioUrl: true, language: true, book: { select: { language: true } } },
    });
    if (!story) { console.log(`${slug}: no existe`); continue; }
    const audioUrl = story.audioUrl || story.audio;
    const language = story.language || story.book?.language || "spanish";
    const mp3 = Buffer.from(await (await fetch(audioUrl)).arrayBuffer());

    const sinAcot = story.text.replace(/\([^)]{1,80}\)/g, " ").replace(/[ \t]{2,}/g, " ");
    const quitadas = (story.text.match(/\([^)]{1,80}\)/g) || []).length;

    for (const [etiqueta, text] of [["base", story.text], ["sinacot", sinAcot]] as const) {
      const { payload } = await alignStoryAudio({ text, title: story.title, audioUrl, language, storyId: story.id });
      const nombre = `${slug}__${etiqueta}`;
      writeFileSync(path.join(outDir, `${nombre}.json`), JSON.stringify({ ...payload, slug: nombre, language }));
      writeFileSync(path.join(outDir, `${nombre}.mp3`), mp3);
      console.log(`${nombre}: ${payload.words.length} tokens (acotaciones quitadas: ${etiqueta === "sinacot" ? quitadas : 0})`);
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
