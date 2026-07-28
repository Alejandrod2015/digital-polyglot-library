/**
 * Experimento: alinear CON y SIN el titulo antepuesto, y dejar las dos
 * versiones en disco para medirlas con la misma regla.
 *
 * Hipotesis: en las historias cuyo narrador NO lee el titulo, aeneas tiene que
 * colocar esas palabras igual, se las come del primer habla real y empuja todo
 * el cuerpo ~0,5 s tarde. Si es eso, la version sin titulo debe perder el
 * desfase constante; si no, la hipotesis cae.
 *
 * Read-only: no escribe en la base.
 *
 *   npx tsx scripts/_karaokeTitleTest.ts <outDir> --slug a,b,c
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
      select: { id: true, slug: true, title: true, text: true, audio: true, audioUrl: true, language: true, book: { select: { language: true } } },
    });
    if (!story) { console.log(`${slug}: no existe`); continue; }
    const audioUrl = story.audioUrl || story.audio;
    const language = story.language || story.book?.language || "spanish";

    const res = await fetch(audioUrl);
    const mp3 = Buffer.from(await res.arrayBuffer());

    for (const [etiqueta, title] of [["contitulo", story.title], ["sintitulo", ""]] as const) {
      const { payload } = await alignStoryAudio({
        text: story.text,
        title,
        audioUrl,
        language,
        storyId: story.id,
      });
      const nombre = `${slug}__${etiqueta}`;
      writeFileSync(path.join(outDir, `${nombre}.json`), JSON.stringify(payload));
      writeFileSync(path.join(outDir, `${nombre}.mp3`), mp3);
      console.log(`${nombre}: ${payload.words.length} tokens, primera palabra en ${payload.words[0]?.startSec?.toFixed(2)}s`);
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
