/**
 * Pagina LOCAL para oir una muestra de narracion con el texto delante.
 * Una muestra es titulo y primer parrafo, y el lector no sabe tocar eso:
 * solo reproduce `audioUrl`, la narracion completa. Entregarla como mp3
 * suelto esta prohibido, asi que se sirve aqui, con el texto al lado, que
 * es lo unico que permite juzgar si la voz y el texto casan.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
const prisma = new PrismaClient();
(async () => {
  const slug = process.argv[2];
  const dir = process.argv[3];
  const reg = JSON.parse(readFileSync(path.join(__dirname, "a2-muestras.json"), "utf8")) as Record<string, { url: string; voiceId: string }>;
  const m = reg[slug];
  if (!m) throw new Error(`no hay muestra registrada de ${slug}`);
  const s = await prisma.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
  if (!s) throw new Error(`no encuentro ${slug}`);
  const parrafo = String(s.text).split(/\n+/).map((x) => x.trim()).filter(Boolean)[0];
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), `<!doctype html><meta charset="utf-8">
<title>Muestra · ${s.title}</title>
<style>
 body{margin:0;background:#111;color:#eee;font:17px/1.7 ui-serif,Georgia,serif;display:flex;justify-content:center}
 main{max-width:38rem;padding:3rem 1.5rem}
 h1{font-size:1.6rem;margin:0 0 1.5rem}
 audio{width:100%;margin-bottom:2rem}
 p{margin:0}
 small{display:block;margin-top:2.5rem;color:#888;font:13px/1.6 ui-sans-serif,system-ui}
</style>
<main>
 <h1>${s.title}</h1>
 <audio controls preload="none" src="${m.url}"></audio>
 <p>${parrafo}</p>
 <small>Muestra: titulo y primer parrafo. Voz ${m.voiceId}.</small>
</main>`);
  console.log(path.join(dir, "index.html"));
  await prisma.$disconnect();
})();
