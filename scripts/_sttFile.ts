// Transcribe un mp3 local y lo compara con un texto esperado. Sirve para
// validar un candidato de re-roll ANTES de empalmarlo.
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { readFileSync } from "fs";
const apiKey = process.env.ELEVENLABS_API_KEY!;
type W = { text: string; start?: number; end?: number; type?: string };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9\s]/gi," ").replace(/\s+/g," ").trim().toLowerCase();
(async () => {
  const file = process.argv[2];
  const buf = readFileSync(file);
  const fd = new FormData();
  fd.append("model_id","scribe_v1"); fd.append("language_code","por"); fd.append("timestamps_granularity","word");
  fd.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "s.mp3");
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method:"POST", headers:{"xi-api-key":apiKey}, body:fd });
  const j = (await r.json()) as { words?: W[]; text?: string };
  const ws = (j.words ?? []).filter(w => (w.type ?? "word") === "word");
  console.log("oído:", j.text?.trim());
  let peor = 0, peorT = 0;
  for (let i=1;i<ws.length;i++){
    const h=(ws[i].start??0)-(ws[i-1].end??0);
    if(h>peor){peor=h;peorT=ws[i-1].end??0;}
    const a=norm(ws[i-1].text), b=norm(ws[i].text);
    if(a&&a===b) console.log(`  ⚠ repite "${ws[i].text}" a los ${(ws[i].start??0).toFixed(1)}s`);
  }
  console.log(`  hueco mayor: ${peor.toFixed(2)}s a los ${peorT.toFixed(1)}s`);
})().catch(e=>{console.log("FATAL",e.message);process.exit(1);});
