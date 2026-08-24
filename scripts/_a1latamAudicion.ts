/** Arma la pagina de audicion de un tema del Traveler ES latam A1: los tres
 *  reproductores con el texto debajo, para oir la narracion leyendo. Se sirve
 *  desde el scratchpad y no desde `public/`, que es ruta desplegable y ensucia
 *  el portón de lotes del push.
 *
 *  uso: OUT=<dir> npx tsx scripts/_a1latamAudicion.ts <topicSlug> */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
const CIUDAD: Record<string, string> = {
  "night-buses": "Cusco", "prices-and-change": "Coyoacán", "calls-and-messages": "Cartagena",
  "help-and-repairs": "Oaxaca", "names-for-things": "San Telmo",
  "doors-and-neighbours": "Barranquilla", "plans-and-invitations": "Palermo",
};
const H = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
(async () => {
  const topic = process.argv[2];
  const out = process.env.OUT;
  if (!topic || !out) { console.error("uso: OUT=<dir> ... <topicSlug>"); process.exit(1); }
  const st = await p.journeyStory.findMany({ where: { journeyId: A1, topic },
    select: { title: true, text: true, slotIndex: true, audioUrl: true, audioFragments: true } });
  st.sort((a, b) => a.slotIndex - b.slotIndex);
  const L: string[] = [`<!doctype html>
<meta charset="utf-8">
<title>${H(CIUDAD[topic] ?? topic)} narrado</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; padding:32px 20px 64px; background:#0d1b2e; color:#e8eef7;
         font:16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .wrap { max-width:720px; margin:0 auto; }
  h1 { font-size:22px; margin:0 0 4px; }
  p.sub { margin:0 0 28px; color:#9db0c9; font-size:14px; }
  h2 { font-size:19px; margin:34px 0 2px; }
  .m { font-size:13px; color:#7f93ad; margin:0 0 10px; }
  audio { width:100%; margin-bottom:14px; }
  .txt { font-size:15px; color:#c3d3e8; border-left:2px solid #1e3a5c; padding-left:14px; }
  .txt p { margin:0 0 12px; }
</style>
<div class="wrap">
<h1>${H(CIUDAD[topic] ?? topic)}, las tres narradas</h1>
<p class="sub">Sin pacing: ninguna se ha ralentizado.</p>`];
  for (const s of st) {
    const fr = (s.audioFragments as Array<{ text?: string; startSec: number; endSec: number }>) ?? [];
    let pal = 0, seg = 0;
    for (const f of fr) { pal += String(f.text ?? "").trim().split(/\s+/).filter(Boolean).length; seg += f.endSec - f.startSec; }
    L.push(`<h2>${H(s.title ?? "")}</h2>`);
    L.push(`<p class="m">${pal} palabras · ${seg.toFixed(1)} s · ${(pal / seg).toFixed(2)} pal/s</p>`);
    L.push(s.audioUrl ? `<audio controls preload="none" src="${s.audioUrl}"></audio>` : `<p class="m">sin audio</p>`);
    L.push(`<div class="txt">`);
    for (const par of String(s.text ?? "").split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)) L.push(`<p>${H(par)}</p>`);
    L.push(`</div>`);
    console.log(`${s.slotIndex} ${s.title} · ${pal} pal · ${(pal / seg).toFixed(2)} pal/s`);
  }
  L.push("</div>");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "index.html"), L.join("\n"), "utf8");
  console.log(`\npagina: ${path.join(out, "index.html")}`);
  await p.$disconnect();
})();
