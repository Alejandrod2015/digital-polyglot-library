import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const SEP=["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"], COM=["ge","ver","be","er","ent"], ART=["der ","die ","das "];
function sp(w:string){let l=w.toLowerCase();for(const a of ART)if(l.startsWith(a)){l=l.slice(a.length);break;}
  for(const q of [...SEP,...COM])if(l.startsWith(q)&&l.length>q.length+3)return l.slice(q.length);return l;}
const lema=(w:string)=>sp(w).normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
(async()=>{
  const A="cmqfnp3tf000032afygkqp8z2";
  const ss = await p.journeyStory.findMany({ where:{journeyId:A},
    select:{ slug:true, title:true, status:true, audioUrl:true, audioStatus:true, audioWordTimings:true, audioSegments:true, vocab:true }});
  for (const s of ss) if (s.audioUrl || s.audioWordTimings || s.audioSegments)
    console.log(`CON AUDIO: ${s.slug} · status=${s.status} · audioStatus=${s.audioStatus} · karaoke=${s.audioWordTimings?"si":"no"} · segmentos=${s.audioSegments?"si":"no"} · plazas=${((s.vocab as any[])??[]).length}`);
  // ¿cuantas de las 94 caen en la historia con audio?
  const conAudio = ss.filter(s=>s.audioUrl);
  const mias = new Set<string>();
  const a0 = await p.journeyStory.findMany({ where:{journeyId:"cmt0a8vb1000m32p1x7r5ba28"}, select:{vocab:true}});
  for (const r of a0) for (const v of ((r.vocab as any[])??[])) mias.add(lema(String(v.word)));
  for (const s of conAudio) {
    const hit = ((s.vocab as any[])??[]).map(v=>String(v.word)).filter(w=>mias.has(lema(w)));
    console.log(`  -> de sus ${((s.vocab as any[])??[]).length} plazas, ${hit.length} chocan con el A0: ${hit.join(", ")}`);
  }
  console.log("publicadas:", ss.filter(s=>s.status==="published").length, "de", ss.length);
  await p.$disconnect();
})();
