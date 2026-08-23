/**
 * Audicion GRATIS de voces rioplatenses del shared library de ElevenLabs.
 * Solo GET /v1/shared-voices y descarga de los preview_url publicos: NO
 * sintetiza nada y no gasta un credito. Escribe public/_voces-ar.html para
 * escuchar las candidatas numeradas desde el navegador.
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import fs from "fs";
import path from "path";

const OUT = path.resolve("public/_voces-ar");
const KEY = process.env.ELEVENLABS_API_KEY;

type Shared = {
  voice_id: string; name: string; accent?: string; gender?: string; age?: string;
  descriptive?: string; use_case?: string; language?: string; preview_url?: string;
  cloned_by_count?: number; description?: string;
};

async function fetchPage(params: Record<string, string>): Promise<Shared[]> {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${qs}`, { headers: { "xi-api-key": KEY! } });
  if (!r.ok) { console.error("HTTP", r.status, (await r.text()).slice(0, 200)); return []; }
  return ((await r.json()) as { voices?: Shared[] }).voices ?? [];
}

async function main() {
  if (!KEY) { console.error("falta ELEVENLABS_API_KEY"); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  // La metadata de acento es poco fiable, asi que se barre por busqueda libre
  // y por filtro de acento, y se deduplica.
  const queries: Record<string, string>[] = [
    { page_size: "100", language: "es", search: "argentin" },
    { page_size: "100", language: "es", search: "argentino" },
    { page_size: "100", language: "es", search: "rioplatense" },
    { page_size: "100", language: "es", search: "buenos aires" },
    { page_size: "100", language: "es", accent: "argentinian" },
    { page_size: "100", language: "es", accent: "argentine" },
    { page_size: "100", language: "es", accent: "rioplatense" },
  ];
  const seen = new Map<string, Shared>();
  for (const q of queries) {
    const list = await fetchPage(q);
    for (const v of list) if (!seen.has(v.voice_id)) seen.set(v.voice_id, v);
    console.log(`consulta ${JSON.stringify(q.search ?? q.accent)} -> ${list.length}`);
  }
  // Sin voces de nino ni de anciano: regla dura del proyecto.
  const EDAD_NO = /child|young child|old|elderly|senior/i;
  const all = [...seen.values()]
    .filter((v) => v.preview_url && !EDAD_NO.test(v.age ?? ""))
    .sort((a, b) => (b.cloned_by_count ?? 0) - (a.cloned_by_count ?? 0));
  console.log(`\nvoces unicas con preview: ${all.length}`);

  let ok = 0;
  for (const v of all) {
    const f = path.join(OUT, `${v.voice_id}.mp3`);
    if (fs.existsSync(f)) { ok++; continue; }
    try {
      const r = await fetch(v.preview_url!);
      if (!r.ok) continue;
      fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      ok++;
    } catch { /* ignorar */ }
  }
  console.log(`previews descargados: ${ok}/${all.length}`);
  fs.writeFileSync(path.join(OUT, "voices.json"), JSON.stringify(all, null, 1));

  const fila = (v: Shared, i: number) => `
  <tr>
    <td class="n">${i + 1}</td>
    <td><b>${v.name}</b><div class="meta">${[v.gender, v.age, v.accent, v.descriptive, v.use_case].filter(Boolean).join(" · ")}</div></td>
    <td><audio preload="none" controls src="/_voces-ar/${v.voice_id}.mp3"></audio></td>
    <td class="id">${v.voice_id}</td>
  </tr>`;
  const html = `<!doctype html><meta charset="utf-8"><title>Voces rioplatenses</title>
<style>body{font:15px/1.5 system-ui;margin:32px;max-width:980px}
h1{font-size:19px}table{border-collapse:collapse;width:100%}
td{border-bottom:1px solid #eee;padding:8px 10px;vertical-align:middle}
.n{color:#999;width:34px}.id{font:12px ui-monospace;color:#888}
.meta{color:#777;font-size:13px}audio{height:32px;width:260px}</style>
<h1>Voces rioplatenses del shared library (${all.length}) preview gratis, sin sintesis</h1>
<p>Friends ES A0 argentina: hace falta UNA voz de narrador (lee todo, incluida el habla citada) y UNA de practica.</p>
<table>${all.map(fila).join("")}</table>`;
  fs.writeFileSync(path.resolve("public/_voces-ar.html"), html);
  console.log("escrito public/_voces-ar.html");
  for (const [i, v] of all.entries())
    console.log(`${String(i + 1).padStart(2)}. ${v.name.padEnd(34)} ${(v.gender ?? "?").padEnd(7)} ${(v.age ?? "?").padEnd(12)} ${(v.accent ?? "?").padEnd(14)} ${v.voice_id}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
