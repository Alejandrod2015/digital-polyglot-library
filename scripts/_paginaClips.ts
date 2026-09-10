/** Pagina local para oir los clips de practica de una historia, con la frase
 *  del ejercicio delante. Las URLs salen de la BASE (R2), no de ficheros
 *  locales: el generador escribe una pagina que apunta a public/, y en cuanto
 *  esa carpeta no esta, el reproductor no suena y parece que el audio fallo. */
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
const prisma = new PrismaClient();
(async () => {
  const slug = process.argv[2], dir = process.argv[3];
  const s = await prisma.journeyStory.findFirst({ where: { slug }, select: { id: true, title: true } });
  const ex = await (prisma as any).storyPracticeExercise.findMany({ where: { set: { storyId: s!.id } } });
  const filas = ex
    .filter((e: any) => e.payload?.audioClip?.clipUrl)
    .map((e: any) => `<li><p class="f">${String(e.payload.audioClip.sentence ?? e.sentence ?? "").replace(/\[\[|\]\]/g, "")}</p>
      <audio controls preload="none" src="${e.payload.audioClip.clipUrl}"></audio></li>`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "clips.html"), `<!doctype html><meta charset="utf-8">
<title>Clips · ${s!.title}</title>
<style>
 body{margin:0;background:#111;color:#eee;font:16px/1.7 ui-sans-serif,system-ui;display:flex;justify-content:center}
 main{max-width:40rem;padding:2.5rem 1.5rem} h1{font-size:1.4rem;margin:0 0 .3rem}
 .m{color:#8a8a8a;font-size:.85rem;margin:0 0 1.5rem}
 ul{list-style:none;padding:0} li{padding:1rem 0;border-top:1px solid #2a2a2a}
 .f{margin:0 0 .5rem;font:17px/1.6 ui-serif,Georgia,serif} audio{width:100%}
</style>
<main><h1>${s!.title}</h1>
<p class="m">${filas.length} clips de practica, con la frase del ejercicio delante.</p>
<ul>${filas.join("\n")}</ul></main>`);
  console.log(`${filas.length} clips`);
  await prisma.$disconnect();
})();
