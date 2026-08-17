// Clips de PALABRA para los ejercicios `match_meaning`, que son los únicos que
// nunca los tuvieron: 21 por journey, 0 con audio en los 8 journeys vivos.
// Sin clip, el botón de audio del match cae al endpoint de síntesis en runtime;
// eso deja el match MUDO sin conexión en todos los idiomas, y en portugués ni
// con conexión (el endpoint corta con 400 a propósito, para no leer portugués
// con voz española).
//
// Copia deliberada del pipeline de `_genWordClips.ts` (carrier declarativo por
// idioma, normalización con lead-in de 90 ms, y el GATE F0 que re-tira hasta
// que la palabra suene a afirmación y no a pregunta). La diferencia está en
// dónde vive la palabra: en el match no es `exercise.word` sino cada
// `payload.pairs[i].word`, y el cliente lee `pair.wordClipUrl`.
//
// La voz sale de `practiceVoiceId(story)`: override por historia si lo hay y,
// si no, LA DEL NARRADOR de esa historia. Nunca una voz fija por idioma.
//
// Uso:
//   npx tsx scripts/_genMatchClips.ts --language portuguese [--dry]
//   npx tsx scripts/_genMatchClips.ts --all [--dry]
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
const WORD_CLIP_VERSION = "w4"; // misma versión que _genWordClips: mismo render, misma clave de contenido.
const F0_PYTHON = join(process.env.HOME || "", ".cache", "dpl-qa", "venv", "bin", "python");
const MAX_TRIES = 6;

function ff(args: string[]): Promise<void> { return new Promise((res,rej)=>{const p=spawn("ffmpeg",args);let e="";p.stderr.on("data",c=>e+=c);p.on("error",rej);p.on("close",c=>c===0?res():rej(new Error(e.slice(0,150))));}); }
function spawnCap(cmd: string, args: string[]): Promise<{code:number;out:string;err:string}> {
  return new Promise((res)=>{const p=spawn(cmd,args);let o="",e="";p.stdout.on("data",c=>o+=c);p.stderr.on("data",c=>e+=c);p.on("error",()=>res({code:-1,out:o,err:e}));p.on("close",c=>res({code:c??-1,out:o,err:e}));});
}
async function normalize(raw: Buffer, outPath: string): Promise<void> {
  const d=mkdtempSync(join(tmpdir(),"mc-")); const i=join(d,"i.mp3");
  try{ writeFileSync(i,raw); await ff(["-y","-loglevel","error","-i",i,"-af","loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur=0.15,adelay=90:all=1","-codec:a","libmp3lame","-b:a","128k",outPath]); }
  finally{ rmSync(d,{recursive:true,force:true}); }
}
function key(voice: string, word: string): string {
  const h=crypto.createHash("sha256").update(`${WORD_CLIP_VERSION}|${voice}|${word.toLowerCase()}`).digest("hex").slice(0,20);
  return `media/practice/word-clip/${h}.mp3`;
}
const WORD_CARRIER: Record<string, string> = {
  es: "La palabra es:", de: "Das Wort lautet:", it: "La parola è:",
  fr: "Le mot est:", pt: "A palavra é:", en: "The word is:",
};
const JOURNEY_LANG_TO_KEY: Record<string, string> = {
  spanish: "es", german: "de", italian: "it", french: "fr", portuguese: "pt", english: "en",
};
function resolveCarrier(journeyLanguage: string | null | undefined): string {
  const k = JOURNEY_LANG_TO_KEY[(journeyLanguage ?? "").trim().toLowerCase()];
  const carrier = k ? WORD_CARRIER[k] : undefined;
  if (!carrier) throw new Error(`[lang-guard] journey.language "${journeyLanguage}" no mapea a carrier (${Object.keys(JOURNEY_LANG_TO_KEY).join(", ")})`);
  return carrier;
}
async function tts(text: string, voice: string, apiKey: string, carrier: string): Promise<Buffer> {
  assertVoiceApproved(voice, "match-word-clip");
  const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`,{method:"POST",headers:{"xi-api-key":apiKey,"Content-Type":"application/json"},
    body:JSON.stringify({ text: `${text.replace(/[.?!]+$/,"")}.`, model_id:MODEL, voice_settings:SETTINGS, previous_text:carrier, next_text:" " })});
  if(!r.ok) throw new Error(`TTS ${r.status} ${(await r.text()).slice(0,80)}`);
  return Buffer.from(await r.arrayBuffer());
}
/** GATE F0 invertido: la palabra debe BAJAR al final (afirmación, no pregunta). */
async function endsRising(mp3Path: string): Promise<{rises:boolean;detail:string}> {
  const r=await spawnCap(F0_PYTHON,["scripts/_f0gate.py",mp3Path,"question"]);
  if(r.code!==0) return {rises:false,detail:"f0-skip"};
  try{ const v=JSON.parse(r.out.trim()); return {rises:!!v.ok, detail:`slope ${v.slope} end ${v.end}`}; }
  catch{ return {rises:false,detail:"f0-parse"}; }
}
async function renderWord(word: string, voice: string, apiKey: string, outPath: string, carrier: string): Promise<{ok:boolean;tries:number;detail:string}> {
  for(let t=1;t<=MAX_TRIES;t++){
    try{
      await normalize(await tts(word,voice,apiKey,carrier), outPath);
      const f=await endsRising(outPath);
      if(!f.rises) return {ok:true,tries:t,detail:f.detail};
    }catch{/* retry */}
  }
  return {ok:false,tries:MAX_TRIES,detail:"sigue subiendo tras reintentos"};
}

type Pair = { word?: string; answer?: string; options?: string[]; wordClipUrl?: string | null; wordVoiceId?: string | null };
type MatchPayload = { pairs?: Pair[]; prompt?: string; audioClip?: unknown };

(async()=>{
  const dry = process.argv.includes("--dry");
  const all = process.argv.includes("--all");
  const langArg = process.argv.find(a=>a.startsWith("--language"));
  const language = langArg ? (langArg.includes("=") ? langArg.split("=")[1] : process.argv[process.argv.indexOf(langArg)+1]) : null;
  if(!all && !language) throw new Error("usage: _genMatchClips.ts (--language <idioma> | --all) [--dry]");
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if(!apiKey && !dry) throw new Error("no ELEVENLABS_API_KEY");

  const journeys = await prisma.journey.findMany({
    where: { status: { notIn: ["archived","draft"] }, ...(language ? { language: { equals: language, mode: "insensitive" } } : {}) },
    select: { id:true, name:true, language:true, variant:true },
  });
  if(!journeys.length) throw new Error(`sin journeys vivos para ${language ?? "(todos)"}`);

  // Una palabra ya renderizada con la MISMA voz se reutiliza: la clave es
  // content-addressed, así que pagarla dos veces sería tirar el dinero.
  const yaRendido = new Map<string,string>();
  let generadas=0, reutilizadas=0, fallidas=0, caracteres=0;

  for(const j of journeys){
    const carrier = resolveCarrier(j.language);
    const sets = await prisma.storyPracticeSet.findMany({
      where: { story: { journeyId: j.id } },
      select: { story: { select: { slug:true, voiceId:true, practiceVoiceId:true } },
                exercises: { where: { type: "match_meaning" }, select: { id:true, payload:true } } },
    });
    console.log(`\n══ ${j.language}/${j.variant} · ${j.name}`);
    for(const s of sets){
      if(!s.exercises.length) continue;
      const voice = practiceVoiceId(s.story);           // ← narrador de ESA historia
      for(const e of s.exercises){
        const payload = (e.payload as MatchPayload | null) ?? {};
        const pairs = payload.pairs ?? [];
        let tocado = false;
        for(const par of pairs){
          const word = (par.word ?? "").trim();
          if(!word) continue;
          if(par.wordClipUrl){ reutilizadas++; continue; }
          const cacheKey = `${voice}|${word.toLowerCase()}`;
          const yaEsta = yaRendido.get(cacheKey);
          if(yaEsta){ par.wordClipUrl = yaEsta; par.wordVoiceId = voice; tocado = true; reutilizadas++; continue; }
          caracteres += word.length;
          if(dry){ console.log(`   · ${s.story.slug}: "${word}" (voz ${voice.slice(0,8)}…)`); continue; }
          const outDir=mkdtempSync(join(tmpdir(),"mcout-"));
          const outPath=join(outDir,"w.mp3");
          const res=await renderWord(word,voice,apiKey!,outPath,carrier);
          if(!res.ok){ console.log(`   ✗ "${word}" (${res.detail})`); fallidas++; rmSync(outDir,{recursive:true,force:true}); continue; }
          const k=key(voice,word);
          await uploadPublicObject({ key:k, body:readFileSync(outPath), contentType:"audio/mpeg" });
          rmSync(outDir,{recursive:true,force:true});
          const url=getPublicObjectUrl(k);
          yaRendido.set(cacheKey,url);
          par.wordClipUrl = url; par.wordVoiceId = voice;
          tocado = true; generadas++;
          console.log(`   ✓ "${word}" [${res.tries}t] ${res.detail}`);
        }
        if(tocado && !dry){
          await prisma.$executeRawUnsafe(
            `UPDATE dp_story_practice_exercises_v1 SET payload=$1::jsonb, "updatedAt"=CURRENT_TIMESTAMP WHERE id=$2`,
            JSON.stringify({ ...payload, pairs }), e.id
          );
        }
      }
    }
  }
  console.log(`\n${dry ? "[--dry] " : ""}generadas ${generadas} · reutilizadas ${reutilizadas} · fallidas ${fallidas} · ${caracteres} caracteres`);
})().catch(e=>{console.log("FATAL",e.message);process.exit(1);}).finally(()=>prisma.$disconnect());
