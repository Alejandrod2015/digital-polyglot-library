/** Página de escucha del Expat FR A0: las historias que ya tienen audio, con
 *  reproductor inline (nada de tarjetas de descarga). Escribe public/_fra0.html. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { writeFileSync } from "fs";
const p = new PrismaClient();
const ID = "cmt09ehi60000320qf9efrypu";
(async () => {
  const j = await p.journey.findUnique({ where: { id: ID }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({ where: { journeyId: ID, NOT: { audioUrl: null } }, select: { slug: true, title: true, topic: true, slotIndex: true, audioUrl: true } }))
    .sort((a, b) => (order.indexOf(a.topic) - order.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const filas = st.map((s) => `
 <div class="box">
  <h2>${s.title}</h2>
  <p class="meta">${s.topic} · <a href="http://localhost:3000/stories/${s.slug}">abrir en el lector con karaoke</a></p>
  <audio controls preload="none" src="${s.audioUrl}"></audio>
 </div>`).join("");
  writeFileSync("public/_fra0.html", `<!doctype html>
<meta charset="utf-8">
<title>Expat FR A0: narración</title>
<style>
 body{font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:780px;margin:40px auto;padding:0 20px;background:#111;color:#eee}
 h1{font-size:21px;margin-bottom:2px} h2{font-size:16px;margin:0 0 4px}
 .meta{color:#999;font-size:14px;margin:0 0 6px} a{color:#8ab4f8}
 audio{width:100%;margin:8px 0 2px}
 .box{border:1px solid #333;border-radius:10px;padding:14px 16px;margin:16px 0}
</style>
<h1>Expat FR A0: narración de Aurore</h1>
<p class="meta">${st.length} de 21 historias con audio · 2,70 w/s · karaoke alineado párrafo a párrafo</p>${filas}
`);
  console.log(`${st.length} historias -> public/_fra0.html`);
  await p.$disconnect();
})();
