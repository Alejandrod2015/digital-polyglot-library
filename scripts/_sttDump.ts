// Vuelca palabra a palabra con tiempos un tramo del audio, para inspeccionar
// una zona concreta. Solo transcribe.
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const apiKey = process.env.ELEVENLABS_API_KEY!;
type W = { text:string; start?:number; end?:number; type?:string };
(async()=>{
  const [slug, desde, hasta] = [process.argv[2], Number(process.argv[3] ?? 0), Number(process.argv[4] ?? 999)];
  const s = await p.journeyStory.findFirst({ where:{ slug }, select:{ audioUrl:true } });
  const buf = Buffer.from(await (await fetch(s!.audioUrl!)).arrayBuffer());
  const fd = new FormData();
  fd.append("model_id","scribe_v1"); fd.append("language_code","por"); fd.append("timestamps_granularity","word");
  fd.append("file", new Blob([new Uint8Array(buf)], { type:"audio/mpeg" }), "s.mp3");
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method:"POST", headers:{"xi-api-key":apiKey}, body:fd });
  const ws = (((await r.json()) as { words?: W[] }).words ?? []).filter(w=>(w.type??"word")==="word");
  for (const w of ws) {
    const t = w.start ?? 0;
    if (t < desde || t > hasta) continue;
    const dur = (w.end ?? 0) - t;
    console.log(`${t.toFixed(2).padStart(6)}s  dur=${dur.toFixed(2)}s  ${w.text}`);
  }
})().finally(()=>p.$disconnect());
