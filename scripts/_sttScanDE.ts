import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const apiKey=process.env.ELEVENLABS_API_KEY!;
const strip=(s:string)=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[""„«»".,!?;:()¿¡'`]/g,"").replace(/\s+/g," ").trim().toLowerCase();
async function stt(buf:Buffer):Promise<string>{
  const fd=new FormData();
  fd.append("model_id","scribe_v1"); fd.append("language_code","deu");
  fd.append("file",new Blob([new Uint8Array(buf)],{type:"audio/mpeg"}),"s.mp3");
  const r=await fetch("https://api.elevenlabs.io/v1/speech-to-text",{method:"POST",headers:{"xi-api-key":apiKey},body:fd});
  if(!r.ok) throw new Error(`STT ${r.status}`);
  return ((await r.json()) as any).text||"";
}
(async()=>{
  const stories=await p.journeyStory.findMany({where:{journeyId:"cmroo4w4v0000324ow1o9qlcp",status:"published"},select:{slug:true,practiceSet:{select:{exercises:{select:{type:true,word:true,payload:true}}}}},orderBy:{createdAt:"asc"}});
  const clips:Array<{slug:string,word:string,sent:string,url:string}>=[];
  for(const s of stories) for(const e of (s.practiceSet?.exercises??[])){
    if(e.type!=="meaning_in_context"&&e.type!=="fill_blank")continue;
    const ac=(e.payload as any)?.audioClip; if(typeof ac?.clipUrl!=="string"||!ac.clipUrl)continue;
    clips.push({slug:s.slug!,word:e.word,sent:ac.sentence,url:ac.clipUrl});
  }
  console.log(`escaneando ${clips.length} clips alemanes...`);
  const flagged:any[]=[]; let done=0;
  for(const c of clips){
    try{
      const buf=Buffer.from(await (await fetch(c.url)).arrayBuffer());
      const heard=await stt(buf);
      const want=strip(c.sent).split(" ").filter(w=>w.length>=3);
      const hset=new Set(strip(heard).split(" ")); const hjoin=strip(heard).split(" ").join("");
      const miss=want.filter(w=>!hset.has(w)&&!hjoin.includes(w));
      const ratio=want.length?1-miss.length/want.length:1;
      if(ratio<0.7) flagged.push({slug:c.slug,word:c.word,ratio:ratio.toFixed(2),sent:c.sent.slice(0,55),heard:heard.trim().slice(0,55)});
    }catch(e:any){ flagged.push({slug:c.slug,word:c.word,err:e.message}); }
    if(++done%50===0) console.log(`  ${done}/${clips.length}`);
  }
  console.log(`\nFLAGGED (STT alemán no cuadra, posible acento corrupto): ${flagged.length}`);
  for(const f of flagged) console.log(`  [${f.ratio??"ERR"}] ${f.slug} "${f.word}" | want: ${f.sent} | heard: ${f.heard??f.err}`);
})().finally(()=>p.$disconnect());
