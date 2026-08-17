import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import * as fs from "fs";
const KEY=process.env.ELEVENLABS_API_KEY!;
const EXCLUDE=new Set(["ewn5JTa3lNPY8QVuZJi6","m7yTemJqdIqrcNleANfX","dZtUsFRKkioPsu9syJF6","pBabaO9WxfrjXjKADHma","P5kgBjTRY5DDGaw8gXLc","D3ws14YxTqcjPaXEOehR","6Mo5ciGH5nWiQacn5FYk","9rvdnhrYoXoUt4igKpBw","PoLFkTquRWtbexdwW3Xa","nAFxIJGj7iSTeltygOfB","6WgXEzo1HGn3i7ilT4Fh","OFrdGXwCzoE56a9sp1fk","0cheeVA5B3Cv6DGq65cT","Iz0qFF5PGG8vpHduEMN2","yytxkT3pNVMWDHn3KXrY"]);
const CATS=[
 {key:"mx-f", label:"Nayeli/Oaxaca (MX F)", q:"gender=female&language=es&accent=mexican"},
 {key:"ar-f", label:"Flor/BsAs (AR F)", q:"gender=female&language=es&accent=argentine"},
 {key:"cl-m", label:"Nico/Chile (CL M)", q:"gender=male&language=es&accent=chilean"},
];
async function dl(url:string,path:string){ const r=await fetch(url,{headers:{"xi-api-key":KEY}}); if(!r.ok) return false; fs.writeFileSync(path,Buffer.from(await r.arrayBuffer())); return true; }
(async()=>{
 const picked:any={};
 for(const c of CATS){
  const r=await fetch(`https://api.elevenlabs.io/v1/shared-voices?${c.q}&page_size=100`,{headers:{"xi-api-key":KEY}});
  const vs=(await r.json()).voices as any[];
  const cand=vs.filter(v=>!EXCLUDE.has(v.voice_id)&&v.preview_url).sort((a,b)=>(b.cloned_by_count||0)-(a.cloned_by_count||0));
  const three:any[]=[];
  for(const v of cand){ if(three.length>=3) break; const p=`public/_friends-voicetest-alts/${c.key}-${three.length+1}.mp3`; if(await dl(v.preview_url,p)) three.push({name:v.name,id:v.voice_id,age:v.age,accent:v.accent,clones:v.cloned_by_count,file:p.replace("public","")}); }
  picked[c.key]={label:c.label,three};
  console.log(c.label+":", three.map(t=>`${t.name}(${t.id.slice(0,6)},${t.age},cl${t.clones})`).join(" | "));
 }
 fs.writeFileSync("scripts/_friends_voice_alts.json",JSON.stringify(picked,null,1));
})();
