import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
const KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || "";
const WANT: Record<string, string> = {
  J8BF9c7OgbHiqagCNoEj: "carito/Daniela",
  "6Gr4AVmTax1pMJO0lHRK": "catalina/Javiera",
  prblQcKOdF08ozhxP2mk: "angela_cl/Gloria",
};
(async () => {
  if (!KEY) { console.log("NO KEY"); process.exit(1); }
  const found: Record<string, any> = {};
  let page = 0;
  const pageSize = 100;
  while (page < 60 && Object.keys(found).length < Object.keys(WANT).length) {
    const url = `https://api.elevenlabs.io/v1/shared-voices?page_size=${pageSize}&page=${page}&language=es`;
    const r = await fetch(url, { headers: { "xi-api-key": KEY } });
    if (!r.ok) { console.log(`page ${page} HTTP ${r.status}`); break; }
    const j: any = await r.json();
    const voices: any[] = j.voices || [];
    for (const v of voices) {
      if (WANT[v.voice_id]) {
        found[v.voice_id] = { owner: v.public_owner_id, name: v.name, accent: v.accent, lang: v.language };
      }
    }
    if (!j.has_more && voices.length < pageSize) break;
    page++;
  }
  for (const id of Object.keys(WANT)) {
    const f = found[id];
    console.log(`${WANT[id].padEnd(18)} ${id}  ${f ? `owner=${f.owner} name="${f.name}" accent=${f.accent}` : "NO ENCONTRADA en es shared (page<60)"}`);
  }
})();
