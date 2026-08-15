/** Solo GET al shared library: previews gratis, cero créditos. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
const KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || "";
(async () => {
  const out: any[] = [];
  for (const page of [0, 1, 2]) {
    const u = new URL("https://api.elevenlabs.io/v1/shared-voices");
    u.searchParams.set("page_size", "100");
    u.searchParams.set("language", "it");
    u.searchParams.set("page", String(page));
    const r = await fetch(u, { headers: { "xi-api-key": KEY } });
    if (!r.ok) { console.error(r.status, (await r.text()).slice(0, 200)); break; }
    const j: any = await r.json();
    out.push(...(j.voices ?? []));
    if (!j.has_more) break;
  }
  const seen = new Set<string>();
  const rows = out.filter((v) => {
    if (seen.has(v.voice_id)) return false; seen.add(v.voice_id);
    const age = String(v.age ?? "").toLowerCase();
    return age !== "old" && age !== "young";   // ni ancianos ni niños
  }).map((v) => ({
    id: v.voice_id, name: v.name, gender: v.gender, age: v.age,
    accent: v.accent, descriptive: v.descriptive, use: v.use_case,
    users: v.cloned_by_count ?? 0, preview: v.preview_url,
  })).sort((a, b) => b.users - a.users);
  console.log(JSON.stringify(rows.slice(0, 40), null, 0));
})();
