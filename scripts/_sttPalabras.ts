import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { readFileSync } from "fs";
(async () => {
  const buf = readFileSync(process.argv[2]);
  const fd = new FormData();
  fd.append("model_id","scribe_v1"); fd.append("language_code", process.argv[3] ?? "spa"); fd.append("timestamps_granularity","word");
  fd.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "s.mp3");
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method:"POST", headers:{"xi-api-key":process.env.ELEVENLABS_API_KEY!}, body:fd });
  const j = await r.json() as any;
  const a = Number(process.argv[4] ?? 0), b = Number(process.argv[5] ?? 1e9);
  for (const w of (j.words ?? []).filter((w:any)=>(w.type??"word")==="word"))
    if ((w.start ?? 0) >= a && (w.start ?? 0) <= b) console.log(`${(w.start??0).toFixed(2)}-${(w.end??0).toFixed(2)}  ${w.text}`);
})();
