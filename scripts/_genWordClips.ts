import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma";
import { getPublicObjectUrl, uploadPublicObject } from "../src/lib/objectStorage";
import { assertVoiceApproved } from "../src/lib/approvedVoices";
import { practiceVoiceId } from "../src/lib/practiceVoice";

const prisma = new PrismaClient();
const MODEL = "eleven_multilingual_v2";
const SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true };
const WORD_CLIP_VERSION = "w3"; // w3: marco declarativo + gate F0 (final debe BAJAR, no pregunta)
const F0_PYTHON = join(process.env.HOME || "", ".cache", "dpl-qa", "venv", "bin", "python");
const MAX_TRIES = 6;

function ff(args: string[]): Promise<void> { return new Promise((res,rej)=>{const p=spawn("ffmpeg",args);let e="";p.stderr.on("data",c=>e+=c);p.on("error",rej);p.on("close",c=>c===0?res():rej(new Error(e.slice(0,150))));}); }
function spawnCap(cmd: string, args: string[]): Promise<{code:number;out:string;err:string}> {
  return new Promise((res)=>{const p=spawn(cmd,args);let o="",e="";p.stdout.on("data",c=>o+=c);p.stderr.on("data",c=>e+=c);p.on("error",()=>res({code:-1,out:o,err:e}));p.on("close",c=>res({code:c??-1,out:o,err:e}));});
}
async function normalize(raw: Buffer, outPath: string): Promise<void> {
  const d=mkdtempSync(join(tmpdir(),"wc-")); const i=join(d,"i.mp3");
  try{ writeFileSync(i,raw); await ff(["-y","-loglevel","error","-i",i,"-af","loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur=0.15","-codec:a","libmp3lame","-b:a","128k",outPath]); }
  finally{ rmSync(d,{recursive:true,force:true}); }
}
function key(voice: string, word: string): string {
  const h=crypto.createHash("sha256").update(`${WORD_CLIP_VERSION}|${voice}|${word.toLowerCase()}`).digest("hex").slice(0,20);
  return `media/practice/word-clip/${h}.mp3`;
}
// Carrier DECLARATIVO por idioma. eleven_multilingual_v2 autodetecta idioma del
// TEXTO COMPLETO (incluido previous_text), así que un carrier en otro idioma le
// mete fonética foránea a la palabra (bug del "acento gringo", 2026-07-23). El
// carrier DEBE estar en el idioma de la historia, derivado de journey.language.
const WORD_CARRIER: Record<string, string> = {
  es: "La palabra es:",
  de: "Das Wort lautet:",
  it: "La parola è:",
  fr: "Le mot est:",
  pt: "A palavra é:",
  en: "The word is:",
};
const JOURNEY_LANG_TO_KEY: Record<string, string> = {
  spanish: "es", german: "de", italian: "it", french: "fr", portuguese: "pt", english: "en",
};
function resolveCarrier(journeyLanguage: string | null | undefined): string {
  const key = JOURNEY_LANG_TO_KEY[(journeyLanguage ?? "").trim().toLowerCase()];
  const carrier = key ? WORD_CARRIER[key] : undefined;
  if (!carrier) throw new Error(`[lang-guard] journey.language "${journeyLanguage}" no mapea a carrier de palabra (${Object.keys(JOURNEY_LANG_TO_KEY).join(", ")})`);
  return carrier;
}
async function tts(text: string, voice: string, apiKey: string, carrier: string): Promise<Buffer> {
  assertVoiceApproved(voice, "word-clip");
  // Marco DECLARATIVO: previous_text (carrier del idioma) como enunciado en
  // curso + punto final + next_text=" " (continuación) → empujan la entonación
  // a BAJAR (no pregunta) y fijan el idioma correcto.
  const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`,{method:"POST",headers:{"xi-api-key":apiKey,"Content-Type":"application/json"},
    body:JSON.stringify({ text: `${text.replace(/[.?!]+$/,"")}.`, model_id:MODEL, voice_settings:SETTINGS, previous_text:carrier, next_text:" " })});
  if(!r.ok) throw new Error(`TTS ${r.status} ${(await r.text()).slice(0,80)}`);
  return Buffer.from(await r.arrayBuffer());
}
// GATE INVERTIDO: _f0gate.py en modo "question" devuelve ok=true si el final
// SUBE. Para una palabra queremos que BAJE → aceptamos cuando el gate de
// pregunta FALLA (ok=false). Devuelve {rises:boolean, detail}.
async function endsRising(mp3Path: string): Promise<{rises:boolean;detail:string}> {
  const r=await spawnCap(F0_PYTHON,["scripts/_f0gate.py",mp3Path,"question"]);
  if(r.code!==0) return {rises:false,detail:"f0-skip"}; // si el gate no corre, no bloqueamos
  try{ const v=JSON.parse(r.out.trim()); return {rises:!!v.ok, detail:`slope ${v.slope} end ${v.end}`}; }
  catch{ return {rises:false,detail:"f0-parse"}; }
}
async function renderWord(word: string, voice: string, apiKey: string, outPath: string, carrier: string): Promise<{ok:boolean;tries:number;detail:string}> {
  for(let t=1;t<=MAX_TRIES;t++){
    try{
      await normalize(await tts(word,voice,apiKey,carrier), outPath);
      const f=await endsRising(outPath);
      if(!f.rises) return {ok:true,tries:t,detail:f.detail};
      // sube = suena a pregunta → re-tira
    }catch{/* retry */}
  }
  return {ok:false,tries:MAX_TRIES,detail:"sigue subiendo tras reintentos"};
}

(async()=>{
  const slug = process.argv[2];
  const force = process.argv.includes("--force");
  const onlyArg = process.argv.find(a=>a.startsWith("--only="));
  const only = onlyArg ? new Set(onlyArg.slice(7).split(",").map(s=>s.trim().toLowerCase())) : null;
  if(!slug) throw new Error("usage: _genWordClips.ts <slug> [--only=w1,w2] [--force]");
  const apiKey = process.env.ELEVENLABS_API_KEY; if(!apiKey) throw new Error("no ELEVENLABS_API_KEY");
  const story = await prisma.journeyStory.findFirst({ where:{slug}, select:{ voiceId:true, practiceVoiceId:true, journey:{select:{language:true}}, practiceSet:{select:{exercises:{select:{id:true, word:true, type:true, payload:true}}}} } });
  if(!story?.practiceSet) throw new Error(`no practice set for ${slug}`);
  const voice = practiceVoiceId(story);
  const carrier = resolveCarrier(story.journey?.language);
  let targets = story.practiceSet.exercises.filter(e=>e.type==="meaning_in_context" && e.word);
  if(only) targets = targets.filter(e=>only.has((e.word||"").trim().toLowerCase()));
  console.log(`${slug}: voz=${voice} | lang=${story.journey?.language} carrier="${carrier}" | ${targets.length} palabras${only?" (--only)":""}`);
  const outDir=mkdtempSync(join(tmpdir(),"wcout-"));
  let ok=0;
  for(const e of targets){
    const word = e.word!;
    const ac = ((e.payload as any)?.audioClip) ?? {};
    if(ac.wordClipUrl && !force){ ok++; continue; }
    const outPath=join(outDir,"w.mp3");
    const res=await renderWord(word,voice,apiKey,outPath,carrier);
    if(!res.ok){ console.log(`  ✗ "${word}" (${res.detail})`); continue; }
    const k=key(voice,word);
    await uploadPublicObject({ key:k, body:readFileSync(outPath), contentType:"audio/mpeg" });
    const url=getPublicObjectUrl(k);
    const newPayload={ ...(e.payload as any), audioClip:{ ...ac, wordClipUrl:url, wordVoiceId:voice } };
    await prisma.$executeRawUnsafe(`UPDATE dp_story_practice_exercises_v1 SET payload=$1::jsonb, "updatedAt"=CURRENT_TIMESTAMP WHERE id=$2`, JSON.stringify(newPayload), e.id);
    console.log(`  ✓ "${word}" [${res.tries}t] ${res.detail} → ${url.slice(-24)}`);
    ok++;
  }
  console.log(`\n${ok}/${targets.length} listos`);
})().catch(e=>{console.log("FATAL",e.message);process.exit(1);}).finally(()=>prisma.$disconnect());
