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
import { F0GateUnavailable, preflightF0Gate, runF0Gate } from "./_f0gateClient"; // gate F0 (_f0gate.py), cerrado

const prisma = new PrismaClient();
const MODEL = "eleven_multilingual_v2";
const SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true };
const WORD_CLIP_VERSION = "w5"; // w5 (2026-09-16): un SINTAGMA se enmarca como frase (ver PHRASE_CARRIER). Cambia la receta del render, asi que cambia la clave de R2 y ninguna re-tirada se queda servida por la copia inmutable anterior. w4: +90ms lead-in silence (w3 arrancaba en 0ms → primer autoplay en sesión de audio fría cortaba el onset; los clips que funcionan tienen ~60ms de lead-in). marco declarativo + gate F0.
const MAX_TRIES = 6;

function ff(args: string[]): Promise<void> { return new Promise((res,rej)=>{const p=spawn("ffmpeg",args);let e="";p.stderr.on("data",c=>e+=c);p.on("error",rej);p.on("close",c=>c===0?res():rej(new Error(e.slice(0,150))));}); }
async function normalize(raw: Buffer, outPath: string): Promise<void> {
  const d=mkdtempSync(join(tmpdir(),"wc-")); const i=join(d,"i.mp3");
  // adelay=90 = 90ms de silencio al INICIO: el primer autoplay ocurre con la
  // sesión de audio iOS en frío y recorta el onset; el lead-in lo absorbe (igual
  // que los clips de los journeys que sí funcionan). apad = cola de 150ms.
  try{ writeFileSync(i,raw); await ff(["-y","-loglevel","error","-i",i,"-af","loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur=0.15,adelay=90:all=1","-codec:a","libmp3lame","-b:a","128k",outPath]); }
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
// Carrier de SINTAGMA. "Le mot est:" anuncia UNA palabra; detras de una
// oracion entera ("c'est ce qu'ils disent tous") el modelo la lee como si
// siguiera hablando y la deja subiendo: los seis sintagmas del FR B1 agotaron
// sus seis tomas cada uno con "sigue subiendo tras reintentos". Con el marco de
// FRASE que ya usa _genPracticeClips.ts, cinco tomas de cuatro sintagmas
// distintos bajaron todas (end entre -5.4 y +1.3 st, 2026-09-16).
const PHRASE_CARRIER: Record<string, { prev: string; next: string }> = {
  es: { prev: "Ahora escucha esta frase.", next: "Muy bien. Ahora sigamos con la siguiente." },
  de: { prev: "Hör dir diesen Satz an.", next: "Gut. Weiter zum nächsten Satz." },
  it: { prev: "Ora ascolta questa frase.", next: "Bene. Passiamo alla prossima." },
  fr: { prev: "Maintenant, écoute cette phrase.", next: "Très bien. Passons à la suivante." },
  pt: { prev: "Agora escute esta frase.", next: "Muito bem. Vamos para a próxima." },
  en: { prev: "Now listen to this sentence.", next: "Good. Let us move on to the next one." },
};
/** Un objetivo con espacio es un sintagma, no una palabra. */
function esSintagma(target: string): boolean { return /\s/.test(target.trim()); }
const JOURNEY_LANG_TO_KEY: Record<string, string> = {
  spanish: "es", german: "de", italian: "it", french: "fr", portuguese: "pt", english: "en",
};
function resolveLangKey(journeyLanguage: string | null | undefined): string {
  const key = JOURNEY_LANG_TO_KEY[(journeyLanguage ?? "").trim().toLowerCase()];
  if (!key || !WORD_CARRIER[key] || !PHRASE_CARRIER[key])
    throw new Error(`[lang-guard] journey.language "${journeyLanguage}" no mapea a carrier (${Object.keys(JOURNEY_LANG_TO_KEY).join(", ")})`);
  return key;
}
/** Marco segun el objetivo: anuncio de palabra, o marco de frase si es sintagma. */
function marcoDe(langKey: string, target: string): { prev: string; next: string } {
  return esSintagma(target)
    ? PHRASE_CARRIER[langKey]
    : { prev: WORD_CARRIER[langKey], next: " " };
}
async function tts(text: string, voice: string, apiKey: string, marco: { prev: string; next: string }): Promise<Buffer> {
  assertVoiceApproved(voice, "word-clip");
  // Marco DECLARATIVO: previous_text (carrier del idioma) como enunciado en
  // curso + punto final + next_text=" " (continuación) → empujan la entonación
  // a BAJAR (no pregunta) y fijan el idioma correcto.
  const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`,{method:"POST",headers:{"xi-api-key":apiKey,"Content-Type":"application/json"},
    body:JSON.stringify({ text: `${text.replace(/[.?!]+$/,"")}.`, model_id:MODEL, voice_settings:SETTINGS, previous_text:marco.prev, next_text:marco.next })});
  if(!r.ok) throw new Error(`TTS ${r.status} ${(await r.text()).slice(0,80)}`);
  return Buffer.from(await r.arrayBuffer());
}
// GATE INVERTIDO: _f0gate.py en modo "question" devuelve ok=true si el final
// SUBE. Para una palabra queremos que BAJE → aceptamos cuando el gate de
// pregunta FALLA (ok=false).
// GATE CERRADO (2026-09-13): antes, si el gate no corria o no parseaba,
// devolvia rises=false y la toma se ACEPTABA ("costar", ES Spain B1). Ahora
// runF0Gate tira F0GateUnavailable y renderWord la deja escapar: el script
// para sin subir. Y un final que el gate no puede medir (end=null, "unvoiced
// tail") tampoco cuenta como "no sube": en modo pregunta sale ok=false, que el
// gate invertido leia como aceptado. Se trata como no verificado y se re-tira.
async function endsRising(mp3Path: string): Promise<{verified:boolean;rises:boolean;detail:string}> {
  const v=await runF0Gate(mp3Path,"question");
  if(v.end===null) return {verified:false,rises:false,detail:`f0 sin medir (${v.reason})`};
  return {verified:true,rises:v.ok,detail:`slope ${v.slope} end ${v.end}`};
}
async function renderWord(word: string, voice: string, apiKey: string, outPath: string, langKey: string): Promise<{ok:boolean;tries:number;detail:string}> {
  const marco = marcoDe(langKey, word);
  let last="sigue subiendo tras reintentos";
  for(let t=1;t<=MAX_TRIES;t++){
    try{
      await normalize(await tts(word,voice,apiKey,marco), outPath);
      const f=await endsRising(outPath);
      if(!f.verified){ last=f.detail; continue; }
      if(!f.rises) return {ok:true,tries:t,detail:f.detail};
      last="sigue subiendo tras reintentos";
      // sube = suena a pregunta → re-tira
    }catch(err){
      if(err instanceof F0GateUnavailable) throw err; // no se reintenta a ciegas: para
      /* retry */
    }
  }
  return {ok:false,tries:MAX_TRIES,detail:last};
}

(async()=>{
  const slug = process.argv[2];
  const force = process.argv.includes("--force");
  const onlyArg = process.argv.find(a=>a.startsWith("--only="));
  const only = onlyArg ? new Set(onlyArg.slice(7).split(",").map(s=>s.trim().toLowerCase())) : null;
  if(!slug) throw new Error("usage: _genWordClips.ts <slug> [--only=w1,w2] [--force]");
  const apiKey = process.env.ELEVENLABS_API_KEY; if(!apiKey) throw new Error("no ELEVENLABS_API_KEY");
  await preflightF0Gate(); // antes de la primera sintesis: sin gate no se gasta un credito
  const story = await prisma.journeyStory.findFirst({ where:{slug}, select:{ voiceId:true, practiceVoiceId:true, journey:{select:{language:true}}, practiceSet:{select:{exercises:{select:{id:true, word:true, type:true, payload:true}}}} } });
  if(!story?.practiceSet) throw new Error(`no practice set for ${slug}`);
  const voice = practiceVoiceId(story);
  const langKey = resolveLangKey(story.journey?.language);
  let targets = story.practiceSet.exercises.filter(e=>e.type==="meaning_in_context" && e.word);
  if(only) targets = targets.filter(e=>only.has((e.word||"").trim().toLowerCase()));
  console.log(`${slug}: voz=${voice} | lang=${story.journey?.language} carrier palabra="${WORD_CARRIER[langKey]}" | ${targets.length} palabras${only?" (--only)":""}`);
  const outDir=mkdtempSync(join(tmpdir(),"wcout-"));
  let ok=0;
  for(const e of targets){
    const word = e.word!;
    const ac = ((e.payload as any)?.audioClip) ?? {};
    if(ac.wordClipUrl && !force){ ok++; continue; }
    const outPath=join(outDir,"w.mp3");
    const res=await renderWord(word,voice,apiKey,outPath,langKey);
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
