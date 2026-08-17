import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { writeFileSync } from "node:fs";
const KEY = process.env.ELEVENLABS_API_KEY!;
const PICKS: Array<[string, string, string]> = [
  ["2Lb1en5ujrODDIqmp7F3", "Jhenny (calma)", "F, suave y dulce; la más adoptada del pool (149k clones)"],
  ["FXGrCtY3PEyfqczBAlqm", "Jhenny (fluida)", "F, cálida y melodiosa, pensada para cuentos"],
  ["zl1Ut8dvwcVSuQSB9XkG", "Ninoska", "F, profe de español, cálida y neutra (muy on-brand)"],
  ["cIBxLwfshLYhRB9lCXEg", "Carolina", "F, natural y balanceada, micrófono pro"],
  ["Wuv1s5YTNCjL9mFJTqo4", "Karolina", "F, cálida, calma y grave"],
];
(async () => {
  const all = new Map<string, any>();
  for (const params of [
    "language=es&accent=peruvian&use_cases=narrative_story&page_size=100",
    "language=es&accent=latin american&use_cases=narrative_story&page_size=100",
    "language=es&accent=standard&use_cases=narrative_story&page_size=100",
    "language=es&accent=latin american&use_cases=informative_educational&page_size=100",
  ]) {
    const r = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${encodeURI(params)}`, { headers: { "xi-api-key": KEY } });
    for (const v of ((await r.json()) as any).voices || []) all.set(v.voice_id, v);
  }
  const rows = PICKS.map(([id, name, desc], i) => {
    const v = all.get(id);
    return `
    <div class="opt"><div class="num">${i + 1}</div>
      <div class="body"><div class="lbl">${name} <span>${desc}</span></div>
      <div class="sen">${(v?.description || "").slice(0, 110)}</div>
      ${v?.preview_url ? `<audio controls preload="none" src="${v.preview_url}"></audio>` : "<div class='sen'>sin preview</div>"}</div></div>`;
  }).join("");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>Voces LATAM; tanda 2</title>
<style>:root{color-scheme:dark}body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0a1424;color:#e9eef7;padding:24px;max-width:680px}
h1{font-size:18px;margin:0 0 4px}p.sub{color:#8ea0bd;font-size:13px;margin:0 0 18px}
.opt{display:flex;align-items:flex-start;gap:14px;padding:12px;margin-bottom:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(52,211,153,.07)}
.num{flex:0 0 auto;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:20px;font-weight:800;background:#1d4ed8;color:#fff}
.body{flex:1}.lbl{font-size:15px;font-weight:700}.lbl span{font-weight:400;color:#8ea0bd;font-size:12px;margin-left:6px}
.sen{color:#c7d3e6;font-size:12px;margin:4px 0}audio{width:100%;margin-top:6px}</style></head><body>
<h1>Tanda 2; narradoras LATAM (perfil Elena, material limpio)</h1>
<p class="sub">Previews gratis. Responde con el número y corro el test de 5 clips con esa voz.</p>
${rows}</body></html>`;
  writeFileSync("public/_voices-peru-2.html", html);
  console.log("previews found:", PICKS.filter(([id]) => all.get(id)?.preview_url).length, "/ 5");
})();
