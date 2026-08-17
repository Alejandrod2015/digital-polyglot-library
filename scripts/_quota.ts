import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
(async () => {
  const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! } });
  const d: any = await r.json();
  console.log("tier:", d.tier, "| usados:", d.character_count, "/", d.character_limit,
    "| reset:", new Date(d.next_character_count_reset_unix * 1000).toISOString());
})();
