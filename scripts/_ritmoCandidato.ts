/** Mide palabras/s por oracion de un mp3 candidato, antes de empalmarlo. */
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { readFileSync } from "fs";
(async () => {
  const buf = readFileSync(process.argv[2]);
  const fd = new FormData();
  fd.append("model_id","scribe_v1"); fd.append("language_code","spa"); fd.append("timestamps_granularity","word");
  fd.append("file", new Blob([new Uint8Array(buf)], { type:"audio/mpeg" }), "s.mp3");
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method:"POST", headers:{"xi-api-key":process.env.ELEVENLABS_API_KEY!}, body:fd });
  const ws = ((await r.json()) as any).words.filter((w:any)=>(w.type??"word")==="word");
  let cur:any[] = [];
  const cierra = () => {
    if (cur.length < 4) { cur = []; return; }
    const d = cur[cur.length-1].end - cur[0].start;
    console.log(`${(cur.length/d).toFixed(2)} w/s · ${cur.map((w:any)=>w.text).join(" ").slice(0,60)}`);
    cur = [];
  };
  for (const w of ws) { cur.push(w); if (/[.!?]$/.test(w.text)) cierra(); }
  cierra();
})();
