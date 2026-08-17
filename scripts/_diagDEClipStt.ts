import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const VOICE = "Ww7Sq9tx9CCOiNOwWgsx";
const SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.3, speed: 0.9, use_speaker_boost: true };
const apiKey = process.env.ELEVENLABS_API_KEY!;
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[“”„«»".,!?;:()¿¡'`]/g,"").replace(/\s+/g," ").trim().toLowerCase();

const SENTENCES = [
  "Er drückt ihr ein kleines Strüßjer in die Arme.",
  "Ronny knallt zwei Currywürste auf die Pappteller.",
  "Nadia bedankt sich, doch Ronny winkt nur ab.",
  "Wat willze, schon gehen?",
  "Hajanoi, gespart ist gespart, sagt Steffi.",
];

function ff(args: string[]): Promise<void> { return new Promise((res,rej)=>{const p=spawn("ffmpeg",args);let e="";p.stderr.on("data",c=>e+=c);p.on("close",c=>c===0?res():rej(new Error(e.slice(0,120))));}); }

async function tts(text: string): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
    method:"POST", headers:{ "xi-api-key":apiKey, "Content-Type":"application/json" },
    body: JSON.stringify({ text, model_id:"eleven_multilingual_v2", voice_settings:SETTINGS }),
  });
  if(!res.ok) throw new Error(`TTS ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
async function stt(buf: Buffer): Promise<string> {
  const fd = new FormData();
  fd.append("model_id","scribe_v1"); fd.append("language_code","deu");
  fd.append("file", new Blob([new Uint8Array(buf)],{type:"audio/mpeg"}), "s.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text",{method:"POST",headers:{"xi-api-key":apiKey},body:fd});
  if(!res.ok) throw new Error(`STT ${res.status}`);
  return ((await res.json()) as any).text || "";
}

(async()=>{
  const dir = mkdtempSync(join(tmpdir(),"diag-"));
  for(const sent of SENTENCES){
    const raw = await tts(sent);
    const heard = await stt(raw);
    const want = strip(sent).split(" ").filter(w=>w.length>=3);
    const heardSet = new Set(strip(heard).split(" "));
    const heardJoined = strip(heard).split(" ").join("");
    const miss = want.filter(w=>!heardSet.has(w) && !heardJoined.includes(w));
    console.log(`\nWANT : ${sent}`);
    console.log(`HEARD: ${heard.trim()}`);
    console.log(`MISS : ${JSON.stringify(miss)}`);
  }
})().catch(e=>console.log("ERR",e.message));
