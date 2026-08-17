import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { writeFileSync } from "node:fs";
const KEY = process.env.ELEVENLABS_API_KEY!;
const PICKS: Array<[string, string]> = [
  ["jdKpAe6rxAe99tFGbsAc", "M maduro, cálido y resonante (jefes, funcionarios con peso)"],
  ["1J0wWp4zPQIvsK7Xwh34", "M media edad, conversacional natural"],
  ["MMwckqU477oQxnAk1SgA", "M media edad, calmo y auténtico"],
  ["j46AY0iVY3oHcnZbgEJg", "M ~35, norteño (Bremen), claro y profesional"],
  ["vmVmHDKBkkCgbLVIOJRb", "M media edad, casual real (colegas, amigos)"],
  ["NE7AIW5DoJ7lUosXV2KR", "F joven, urbana y alegre (amigas Berlín)"],
  ["h8PCn0HukMaFj1sJwcjY", "F ~28, narradora cálida e íntima"],
  ["M39iqBUcu1jyiwM5PfSy", "F media edad, genuina y serena"],
  ["CoFoB7a7PXA8RBsMHbua", "F media edad, descarada con acento berlinés sutil"],
  ["nGISSznGHAgSTKaMXEPO", "F media edad, casual y amistosa"],
];
(async () => {
  const all = new Map<string, any>();
  for (const params of ["language=de&use_cases=narrative_story&page_size=100", "language=de&use_cases=conversational&page_size=100"]) {
    const r = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${params}`, { headers: { "xi-api-key": KEY } });
    for (const v of ((await r.json()) as any).voices || []) all.set(v.voice_id, v);
  }
  const rows = PICKS.map(([id, desc], i) => {
    const v = all.get(id);
    return `
    <div class="opt"><div class="num">${i + 1}</div>
      <div class="body"><div class="lbl">${v?.name ?? id} <span>${desc}</span></div>
      <div class="sen">${(v?.description || "").slice(0, 110)}</div>
      ${v?.preview_url ? `<audio controls preload="none" src="${v.preview_url}"></audio>` : "<div class='sen'>sin preview</div>"}</div></div>`;
  }).join("");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>Banquillo DE; 10 voces</title>
<style>:root{color-scheme:dark}body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0a1424;color:#e9eef7;padding:24px;max-width:680px}
h1{font-size:18px;margin:0 0 4px}p.sub{color:#8ea0bd;font-size:13px;margin:0 0 18px}
.opt{display:flex;align-items:flex-start;gap:14px;padding:12px;margin-bottom:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(52,211,153,.07)}
.num{flex:0 0 auto;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:20px;font-weight:800;background:#1d4ed8;color:#fff}
.body{flex:1}.lbl{font-size:14px;font-weight:700}.lbl span{font-weight:400;color:#8ea0bd;font-size:12px;margin-left:6px}
.sen{color:#c7d3e6;font-size:12px;margin:4px 0}audio{width:100%;margin-top:6px}</style></head><body>
<h1>10 voces alemanas candidatas para el banquillo (personajes futuros)</h1>
<p class="sub">Previews gratis del shared library; metadata del creador, no verificada al oído. Responde con los números que quieras guardar.</p>
${rows}</body></html>`;
  writeFileSync("public/_de-bench.html", html);
  console.log("bench page ok");
})();
