/**
 * Genera un bed musical instrumental con ElevenLabs Music API (POST /v1/music).
 * Licencia: uso comercial amplio (ElevenLabs Music Terms). Automatizable/pipeline.
 * Uso: tsx scripts/_genMusicBed.ts "<prompt>" <ms> <outfile>
 */
import fs from "fs";

for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

async function main() {
  const prompt = process.argv[2];
  const ms = parseInt(process.argv[3] || "30000", 10);
  const out = process.argv[4] || "/tmp/dpl-sample/music/gen.mp3";
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const res = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      force_instrumental: true,
      music_length_ms: ms,
      model_id: "music_v1",
    }),
  });
  if (!res.ok) {
    console.error(`MUSIC FAIL ${res.status}: ${(await res.text()).slice(0, 400)}`);
    process.exit(1);
  }
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`OK wrote ${out} (${fs.statSync(out).size} bytes)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
