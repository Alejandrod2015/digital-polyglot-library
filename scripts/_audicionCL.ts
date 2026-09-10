/** Audicion de las tres voces chilenas APROBADAS para el tema 4 del B1 latam.
 *  Usa las previews gratis de la cuenta (GET), no sintetiza nada. */
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
const prisma = new PrismaClient();
const IDS = ["yytxkT3pNVMWDHn3KXrY", "zwsW3KvGYEC2nBc7rlnA", "6Gr4AVmTax1pMJO0lHRK"];
(async () => {
  const dir = process.argv[2];
  const s = await prisma.journeyStory.findFirst({ where: { slug: "la-casilla-en-blanco" }, select: { title: true, text: true } });
  const parrafo = String(s!.text).split(/\n+/).map((x) => x.trim()).filter(Boolean)[0];
  const filas: string[] = [];
  for (const id of IDS) {
    const r = await fetch(`https://api.elevenlabs.io/v1/voices/${id}`, { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! } });
    const j = await r.json() as any;
    const n = await prisma.journeyStory.count({ where: { voiceId: id } });
    filas.push(`<li><h2>${j.name}</h2><p class="m">${j.labels?.gender ?? ""} · ${j.labels?.accent ?? ""} · ${n} historias narradas</p>
      <audio controls preload="none" src="${j.preview_url}"></audio></li>`);
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), `<!doctype html><meta charset="utf-8">
<title>Voces chilenas · tema 4</title>
<style>
 body{margin:0;background:#111;color:#eee;font:16px/1.7 ui-sans-serif,system-ui;display:flex;justify-content:center}
 main{max-width:40rem;padding:2.5rem 1.5rem}
 h1{font-size:1.4rem;margin:0 0 .5rem} h2{font-size:1.05rem;margin:0 0 .2rem}
 ul{list-style:none;padding:0} li{padding:1.2rem 0;border-top:1px solid #2a2a2a}
 .m{color:#8a8a8a;font-size:.85rem;margin:0 0 .6rem} audio{width:100%}
 blockquote{margin:1.5rem 0 2rem;padding-left:1rem;border-left:2px solid #333;color:#bdbdbd;font:17px/1.7 ui-serif,Georgia,serif}
</style>
<main>
 <h1>Tema 4 · Animals &amp; Farms (Chiloé, Chile)</h1>
 <p class="m">Las tres voces chilenas ya aprobadas. Estas son las muestras gratis de la biblioteca, no nuestro texto.</p>
 <blockquote>${parrafo}</blockquote>
 <ul>${filas.join("\n")}</ul>
</main>`);
  console.log("ok");
  await prisma.$disconnect();
})();
