import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
(async () => {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) { console.log("NO HAY ELEVENLABS_API_KEY"); return; }
  const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": k } });
  const j: any = await r.json();
  if (!r.ok) { console.log("HTTP", r.status, JSON.stringify(j).slice(0,200)); return; }
  console.log("tier:", j.tier, "| usados:", j.character_count, "/", j.character_limit,
    "| restan:", j.character_limit - j.character_count,
    "| reset:", new Date(j.next_character_count_reset_unix * 1000).toISOString().slice(0,16));
})();
