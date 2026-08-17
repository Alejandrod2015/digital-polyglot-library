import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { readFileSync } from "node:fs";
(async () => {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1"); fd.append("language_code", "spa");
  fd.append("file", new Blob([new Uint8Array(readFileSync("/tmp/pie-cut.mp3"))], { type: "audio/mpeg" }), "s.mp3");
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! }, body: fd });
  console.log("Scribe oye el recorte como:", JSON.stringify(((await r.json()) as any).text));
})();
