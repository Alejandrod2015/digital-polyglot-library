import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import crypto from "node:crypto";
import { PrismaClient } from "../src/generated/prisma";
import { getPublicObjectUrl } from "../src/lib/objectStorage";
import { practiceVoiceId } from "../src/lib/practiceVoice";
import * as AV from "../src/lib/approvedVoices";
const prisma = new PrismaClient();
const VERS = ["w5","w4","w3","w2","w1"];
function wkey(v:string,voice:string,w:string){return `media/practice/word-clip/${crypto.createHash("sha256").update(`${v}|${voice}|${w.toLowerCase()}`).digest("hex").slice(0,20)}.mp3`;}
async function head(u:string){try{return (await fetch(u,{method:"HEAD"})).status===200;}catch{return false;}}
(async()=>{
  const ids = Object.values(AV as any).flatMap((v:any)=> Array.isArray(v)? v : (v && typeof v==="object" ? Object.values(v):[]))
    .flatMap((x:any)=> typeof x==="string"? [x] : (x && typeof x==="object" && typeof x.voiceId==="string" ? [x.voiceId]:[]))
    .filter((s:any)=> typeof s==="string" && /^[A-Za-z0-9]{20}$/.test(s));
  const voces = Array.from(new Set(ids));
  console.log("voces aprobadas probadas:", voces.length);
  for (const [label,jid] of [["es/spain a1","cmsvz6mz9000732gsgsfer0ko"],["es/latam a2","cmtgelq560007j84n3ujx9bpd"]] as [string,string][]) {
    const stories = await prisma.journeyStory.findMany({ where:{journeyId:jid}, select:{ slug:true, voiceId:true, practiceVoiceId:true, practiceSet:{select:{exercises:{select:{type:true,word:true,featured:true,payload:true}}}} } , take:3});
    console.log(`\n### ${label}`);
    for (const s of stories) {
      const voz = practiceVoiceId(s as any);
      const faltan = (s.practiceSet?.exercises??[]).filter(e=>e.type==="meaning_in_context" && e.featured!==false && !((e.payload as any)?.audioClip?.wordClipUrl)).slice(0,3);
      console.log(`  ${s.slug} voz=${voz}`);
      for (const e of faltan) {
        const hits:string[]=[];
        for (const v of voces) for (const ver of VERS) { const u=getPublicObjectUrl(wkey(ver,v,e.word!)); if(u && await head(u)) hits.push(`${ver}/${v.slice(0,6)}`); }
        console.log(`    "${e.word}" -> ${hits.length? hits.join(","): "NO existe con ninguna voz aprobada"}`);
      }
    }
  }
  await prisma.$disconnect();
})().catch(async(e)=>{console.error(e);await prisma.$disconnect();process.exit(1);});
