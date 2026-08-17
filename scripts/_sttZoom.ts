// Dada una frase del texto, localiza su zona en el audio y vuelca lo que se
// oye palabra a palabra con tiempos. Solo transcribe.
//   npx tsx scripts/_sttZoom.ts <slug> "trozo de la frase"
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const apiKey = process.env.ELEVENLABS_API_KEY!;
type W = { text:string; start?:number; end?:number; type?:string };
const norm = (s:string)=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9\s]/gi," ").replace(/\s+/g," ").trim().toLowerCase();
(async()=>{
  const [slug, trozo] = [process.argv[2], process.argv[3]];
  const s = await p.journeyStory.findFirst({ where:{ slug }, select:{ audioUrl:true } });
  const buf = Buffer.from(await (await fetch(s!.audioUrl!)).arrayBuffer());
  const fd = new FormData();
  fd.append("model_id","scribe_v1"); fd.append("language_code","por"); fd.append("timestamps_granularity","word");
  fd.append("file", new Blob([new Uint8Array(buf)], { type:"audio/mpeg" }), "s.mp3");
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text",{method:"POST",headers:{"xi-api-key":apiKey},body:fd});
  const ws = (((await r.json()) as { words?:W[] }).words ?? []).filter(w=>(w.type??"word")==="word");
  // Ancla: la primera palabra distintiva del trozo buscado.
  const claves = norm(trozo).split(" ").filter(w=>w.length>=4);
  let idx = -1;
  for (const k of claves) { idx = ws.findIndex(w=>norm(w.text).includes(k)); if (idx>=0) break; }
  if (idx < 0) { console.log("no se encontró el ancla en el audio"); return; }
  const desde = Math.max(0, idx-4), hasta = Math.min(ws.length, idx+16);
  console.log(`ancla en ${(ws[idx].start??0).toFixed(2)}s\n`);
  for (let i=desde;i<hasta;i++){
    const w=ws[i]; const t=w.start??0; const dur=(w.end??0)-t;
    const hueco = i>desde ? t-(ws[i-1].end??0) : 0;
    const marca = dur<=0.001 ? "  ← duración CERO" : hueco>=0.5 ? `  ← hueco de ${hueco.toFixed(2)}s antes` : "";
    console.log(`${t.toFixed(2).padStart(6)}s dur=${dur.toFixed(2)}  ${w.text}${marca}`);
  }
})().finally(()=>p.$disconnect());
