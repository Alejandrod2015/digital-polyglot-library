import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { readFileSync } from "node:fs";
(async () => {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1"); fd.append("language_code", "spa");
  fd.append("file", new Blob([new Uint8Array(readFileSync(process.argv[2]))], { type: "audio/mpeg" }), "s.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! }, body: fd });
  console.log(((await res.json()) as any).text);
})();
