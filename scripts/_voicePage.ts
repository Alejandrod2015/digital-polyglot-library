import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { writeFileSync } from "node:fs";
const KEY = process.env.ELEVENLABS_API_KEY!;
const PICKS = [
  ["dyTONAae6PhdRb3hMKPM", "Elena", "F media edad, narradora, cálida y natural"],
  ["TTfJ6x7olNX5yvlMWLyu", "Jorge", "M joven, narrador, cálido y cercano"],
  ["YlRnRXiYsSCoYTaKcVmH", "Sigefrido", "M media edad, narrador, articulado y estable"],
  ["hMVIjTMgEWvSbYaHT4k9", "Chizus", "M ~30, narrador, claro y templado"],
  ["WrKMouCyVAmTemNLZkOw", "Emilia", "F joven, narradora, calma y suave"],
  ["1aJyZpkt0vxhGPBnPyrs", "Fernanda", "F media edad, audiolibro, neutra LATAM"],
];
(async () => {
  const r = await fetch("https://api.elevenlabs.io/v1/shared-voices?language=es&search=peru&page_size=30", { headers: { "xi-api-key": KEY } });
  const d: any = await r.json();
  const byId = new Map((d.voices || []).map((v: any) => [v.voice_id, v]));
  const rows = PICKS.map(([id, name, desc], i) => {
    const v: any = byId.get(id);
    if (!v?.preview_url) return `<div class="opt"><div class="num">${i + 1}</div><div class="body"><div class="lbl">${name}</div><div class="sen">sin preview</div></div></div>`;
    return `
    <div class="opt"><div class="num">${i + 1}</div>
      <div class="body"><div class="lbl">${name} <span>${desc}</span></div>
      <div class="sen">${(v.description || "").slice(0, 110)}</div>
      <audio controls preload="none" src="${v.preview_url}"></audio></div></div>`;
  }).join("");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>Voces Perú; candidatas narrador</title>
<style>:root{color-scheme:dark}body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0a1424;color:#e9eef7;padding:24px;max-width:680px}
h1{font-size:18px;margin:0 0 4px}p.sub{color:#8ea0bd;font-size:13px;margin:0 0 18px}
.opt{display:flex;align-items:flex-start;gap:14px;padding:12px;margin-bottom:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(52,211,153,.07)}
.num{flex:0 0 auto;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:20px;font-weight:800;background:#1d4ed8;color:#fff}
.body{flex:1}.lbl{font-size:15px;font-weight:700}.lbl span{font-weight:400;color:#8ea0bd;font-size:12px;margin-left:6px}
.sen{color:#c7d3e6;font-size:12px;margin:4px 0}audio{width:100%;margin-top:6px}</style></head><body>
<h1>Candidatas narrador Perú (previews gratis del shared library)</h1>
<p class="sub">Responde con el número. Acentos según metadata del creador, no verificados al oído.</p>
${rows}</body></html>`;
  writeFileSync("public/_voices-peru.html", html);
  console.log("page written; previews found:", PICKS.filter(([id]) => byId.get(id)?.preview_url).length, "/", PICKS.length);
})();
