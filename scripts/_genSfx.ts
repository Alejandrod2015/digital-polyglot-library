/**
 * Genera un efecto de sonido con ElevenLabs Sound Effects API
 * (POST /v1/sound-generation). Licencia comercial. Automatizable/pipeline.
 * Uso: tsx scripts/_genSfx.ts "<prompt>" <duration_seconds> <outfile>
 */
import fs from "fs";

for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

async function main() {
  const text = process.argv[2];
  const dur = parseFloat(process.argv[3] || "5");
  const out = process.argv[4] || "/tmp/dpl-sample/music/sfx.mp3";
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const res = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, duration_seconds: dur, prompt_influence: 0.5 }),
  });
  if (!res.ok) {
    console.error(`SFX FAIL ${res.status}: ${(await res.text()).slice(0, 400)}`);
    process.exit(1);
  }
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`OK ${out} (${fs.statSync(out).size} bytes)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
