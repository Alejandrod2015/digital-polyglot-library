/**
 * Asigna dialogueSpec + voiceId (narrador) a las 21 historias del journey
 * Hamburg "Hanseat" C1. NO genera audio. Parser known-speaker: una línea es
 * turno de personaje SOLO si el nombre antes de ": " está en VOICE_MAP.
 * Usage: tsx scripts/_setHamburgDialogueSpecs.ts --dry-run | --apply
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const JOURNEY_ID = "cmrdbz11t000032asrvo832i9";
const V: Record<string,string> = {
  moritz:"Ww7Sq9tx9CCOiNOwWgsx", ela_warm:"SJJe86Va82zRzg6zi2dX", marius:"JDXBO1etYlVlJZRMoYzH",
  enniah:"WHaUUVTDq47Yqc9aDbkH", felix:"IQuqJPpP2hMHjjDY2QTe", daien:"9iYBWBbTzTDIt6imiMxp",
  charlie:"vmVmHDKBkkCgbLVIOJRb", eleonore:"8SdTD5IMgFKT1jp7JbPC", jane:"hOBDmVrVUuqtp1I3KsIq",
  ben_de:"MMwckqU477oQxnAk1SgA", daniel:"wcqN36SUOZ0EhToc2OIu", joerg:"KVgqk9YVh0pWUJiWQN8j",
  marlena:"MTTjXkEpZepLTqO0xH0f", ela_cheer:"NE7AIW5DoJ7lUosXV2KR",
};
const VOICE_MAP: Record<string,string> = {
  narrator: V.moritz,
  nora: V.ela_warm, ole: V.marius, wiebke: V.enniah, carstens: V.felix,
  merle: V.daien, fiete: V.charlie, boysen: V.eleonore, grit: V.eleonore,
  greve: V.jane, timm: V.ben_de, voss: V.daniel, schreier: V.joerg,
  kunde: V.daniel, "verkäuferin": V.marlena, dose: V.ben_de, mann: V.ben_de, sofia: V.ela_cheer,
};
const SPEAKER_RE = /^\s*([\p{Lu}][\p{L}\p{M}.'-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'-]*){0,3})\s*:\s+(.*\S)\s*$/u;
function parse(text: string){
  const lines = text.replace(/<[^>]+>/g," ").split(/\r?\n/).map(l=>l.trim());
  const segs:{speaker:string;text:string;voice:string}[]=[]; let buf:string[]=[];
  const flush=()=>{const t=buf.join(" ").replace(/\s+/g," ").trim(); if(t) segs.push({speaker:"narrator",text:t,voice:V.moritz}); buf=[];};
  for(const line of lines){ if(!line) continue; const m=line.match(SPEAKER_RE); const name=m?m[1].trim().toLowerCase():null;
    if(m&&name&&VOICE_MAP[name]){ flush(); segs.push({speaker:m[1].trim(),text:m[2].trim(),voice:VOICE_MAP[name]}); } else buf.push(line); }
  flush(); return segs;
}
(async()=>{
  const apply=process.argv.includes("--apply");
  if(!apply&&!process.argv.includes("--dry-run")){console.error("pass --dry-run or --apply");process.exit(1);}
  const p=new PrismaClient();
  const rows=await p.journeyStory.findMany({where:{journeyId:JOURNEY_ID, status:"published"}, select:{id:true,slug:true,text:true}}) as any[];
  const n2v=Object.entries(V).reduce((a,[k,v])=>(a[v]=k,a),{} as Record<string,string>);
  let bad=0;
  for(const r of rows){
    const spec=parse(r.text||"");
    const chars=spec.filter(s=>s.speaker!=="narrator");
    const voices=new Set(chars.map(s=>s.voice));
    const cast=[...new Set(chars.map(s=>`${s.speaker}=${n2v[s.voice]}`))];
    // clash: dos personajes distintos con misma voz en la misma historia
    const byVoice:Record<string,Set<string>>={}; chars.forEach(s=>{(byVoice[s.voice]??=new Set()).add(s.speaker.toLowerCase());});
    const clash=Object.values(byVoice).filter(s=>s.size>1);
    const tag=(voices.size<2?" <2 VOCES!":"")+(clash.length?" CLASH!":"");
    if(tag) bad++;
    console.log(`  ${r.slug.slice(0,34).padEnd(34)} ${spec.length} segs | ${cast.join(", ")}${tag}`);
    if(apply) await p.journeyStory.update({where:{id:r.id}, data:{dialogueSpec:spec as any, voiceId:V.moritz}});
  }
  console.log(`\n${apply?"APPLIED":"[dry]"} 21 | problemas: ${bad}`);
  await p.$disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
