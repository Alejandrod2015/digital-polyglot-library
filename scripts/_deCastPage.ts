import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { writeFileSync } from "node:fs";
const KEY = process.env.ELEVENLABS_API_KEY!;
const CAST: Array<[string, string, string, string]> = [
  ["Narrador", "moritz", "Ww7Sq9tx9CCOiNOwWgsx", "M maduro, barítono; el narrador de siempre del alemán"],
  ["Nadia (protagonista expat, 29)", "ela_warm", "SJJe86Va82zRzg6zi2dX", "F joven, cálida y empática"],
  ["Timo (Mitbewohner, 28)", "marius", "JDXBO1etYlVlJZRMoYzH", "M joven, natural"],
  ["Frau Brandt (jefa, 52)", "eleonore", "8SdTD5IMgFKT1jp7JbPC", "F madura, formal; la voz 'Frau' del pool"],
  ["Ayşe (Späti, 38)", "enniah", "WHaUUVTDq47Yqc9aDbkH", "F media edad, cálida"],
];
(async () => {
  const rows: string[] = [];
  for (let i = 0; i < CAST.length; i++) {
    const [role, slot, id, desc] = CAST[i];
    const r = await fetch(`https://api.elevenlabs.io/v1/voices/${id}`, { headers: { "xi-api-key": KEY } });
    const v: any = r.ok ? await r.json() : {};
    rows.push(`
    <div class="opt"><div class="num">${i + 1}</div>
      <div class="body"><div class="lbl">${role} <span>${slot} · ${desc}</span></div>
      ${v.preview_url ? `<audio controls preload="none" src="${v.preview_url}"></audio>` : `<div class="sen">sin preview (${r.status})</div>`}</div></div>`);
  }
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>Cast DE B1 Expat</title>
<style>:root{color-scheme:dark}body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0a1424;color:#e9eef7;padding:24px;max-width:680px}
h1{font-size:18px;margin:0 0 4px}p.sub{color:#8ea0bd;font-size:13px;margin:0 0 18px}
.opt{display:flex;align-items:flex-start;gap:14px;padding:12px;margin-bottom:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(52,211,153,.07)}
.num{flex:0 0 auto;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:20px;font-weight:800;background:#1d4ed8;color:#fff}
.body{flex:1}.lbl{font-size:14px;font-weight:700}.lbl span{font-weight:400;color:#8ea0bd;font-size:11px;margin-left:6px}
.sen{color:#c7d3e6;font-size:13px;margin:4px 0}audio{width:100%;margin-top:6px}</style></head><body>
<h1>Cast del journey Expat B1 (Berlín): asignación propuesta</h1>
<p class="sub">Voces del pool alemán ya licenciado. Responde "ok" o el número del rol cuya voz quieras cambiar.</p>
${rows.join("")}</body></html>`;
  writeFileSync("public/_de-cast.html", html);
  console.log("page ok");
})();
