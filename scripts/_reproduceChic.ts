/**
 * Diagnostico LOCAL: re-tira las palabras que el gate F0 no pudo medir y
 * guarda TODAS las tomas como fixture. No sube nada, no toca la BD.
 * Replica exactamente el render de _genWordClips.ts (mismo carrier, settings,
 * modelo y normalizacion) para que el fixture sea representativo.
 * Gate: usa runF0Gate de ./_f0gateClient (_f0gate.py), igual que el generador.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertVoiceApproved } from "../src/lib/approvedVoices";
import { F0GateUnavailable, preflightF0Gate, runF0Gate } from "./_f0gateClient";

const VOICE = "ucMmKRQbfDEYyb2IIGax";
const MODEL = "eleven_multilingual_v2";
const SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true };
const CARRIER = "Le mot est:";
const OUT = "scripts/_f0fixtures";

function ff(args: string[]): Promise<void> { return new Promise((res,rej)=>{const p=spawn("ffmpeg",args);let e="";p.stderr.on("data",c=>e+=c);p.on("error",rej);p.on("close",c=>c===0?res():rej(new Error(e.slice(0,150))));}); }
async function normalize(raw: Buffer, outPath: string): Promise<void> {
  const d=mkdtempSync(join(tmpdir(),"rc-")); const i=join(d,"i.mp3");
  try{ writeFileSync(i,raw); await ff(["-y","-loglevel","error","-i",i,"-af","loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur=0.15,adelay=90:all=1","-codec:a","libmp3lame","-b:a","128k",outPath]); }
  finally{ rmSync(d,{recursive:true,force:true}); }
}
async function tts(text: string, apiKey: string): Promise<Buffer> {
  assertVoiceApproved(VOICE, "word-clip-diagnostico");
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, { method:"POST",
    headers:{ "xi-api-key":apiKey, "Content-Type":"application/json" },
    body: JSON.stringify({ text: `${text.replace(/[.?!]+$/,"")}.`, model_id: MODEL, voice_settings: SETTINGS, previous_text: CARRIER, next_text: " " }) });
  if(!r.ok) throw new Error(`TTS ${r.status} ${(await r.text()).slice(0,80)}`);
  return Buffer.from(await r.arrayBuffer());
}
(async () => {
  const apiKey = process.env.ELEVENLABS_API_KEY; if(!apiKey) throw new Error("no ELEVENLABS_API_KEY");
  await preflightF0Gate();
  mkdirSync(OUT, { recursive: true });
  const words = ["chic", "propre"];
  const TAKES = 3; // 6 por palabra fueron las de la tanda; 3 bastan para reproducir
  let chars = 0;
  for (const w of words) {
    for (let t = 1; t <= TAKES; t++) {
      const path = join(OUT, `retiro_${w}_t${t}.mp3`);
      chars += w.replace(/[.?!]+$/,"").length + 1;
      await normalize(await tts(w, apiKey), path);
      try {
        const v = await runF0Gate(path, "question");
        const medible = v.end !== null;
        console.log(`${w} t${t}: ${medible ? `MEDIBLE end=${v.end} slope=${v.slope}` : `NO MEDIBLE (${v.reason})`} -> ${path}`);
      } catch (e) {
        if (e instanceof F0GateUnavailable) { console.log(`${w} t${t}: gate no disponible: ${(e as Error).message}`); }
        else throw e;
      }
    }
  }
  console.log(`\ncaracteres sintetizados: ${chars}`);
})().catch(e=>{ console.log("FATAL", e.message); process.exit(1); });
