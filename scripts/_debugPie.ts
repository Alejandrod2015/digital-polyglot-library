import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { readFileSync, writeFileSync } from "node:fs";
const KEY = process.env.ELEVENLABS_API_KEY!;
const JHENNY = "FXGrCtY3PEyfqczBAlqm";
(async () => {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${JHENNY}`, {
    method: "POST", headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text: "La palabra es pie.", model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3, speed: 0.9, use_speaker_boost: true } }),
  });
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync("/tmp/pie-carrier.mp3", buf);
  const fd = new FormData();
  fd.append("model_id", "scribe_v1"); fd.append("language_code", "spa"); fd.append("timestamps_granularity", "word");
  fd.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "c.mp3");
  const st = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": KEY }, body: fd });
  const d: any = await st.json();
  console.log("texto:", d.text);
  for (const w of d.words || []) if (w.type === "word") console.log(JSON.stringify({ t: w.text, s: w.start, e: w.end }));
})();
