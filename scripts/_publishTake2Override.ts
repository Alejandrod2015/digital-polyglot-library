import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import crypto from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPublicObjectUrl, uploadPublicObject } from "../src/lib/objectStorage";

const CLIP_VERSION="v4";
const strip=(s:string)=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[“”„«»".,!?;:()¿¡'`]/g,"").replace(/\s+/g," ").trim().toLowerCase();
const clipKey=(voice:string,sentence:string,rev:number)=>{
  const hash=crypto.createHash("sha256").update(`${CLIP_VERSION}|${voice}|${sentence}${rev?`|r${rev}`:""}`).digest("hex").slice(0,16);
  return `media/practice/sentence-clip/${hash}.mp3`;
};

// palabra por historia + voz con la que se rindió la toma (del manifest)
const JOBS:Array<[string,string[],string]>=[
  ["klungel-oder-herzblut",["Strüßjer"],"Ww7Sq9tx9CCOiNOwWgsx"],
  ["currywurst-und-viel-gemecker",["wat willze","die Currywurst"],"Ww7Sq9tx9CCOiNOwWgsx"],
  ["sparen-wie-ein-schwabe",["hajanoi"],"Ww7Sq9tx9CCOiNOwWgsx"],
  ["dahoam-auf-der-wiesn",["ruhig","wohlig"],"Ww7Sq9tx9CCOiNOwWgsx"],
  ["todo-es-weon",["cuático"],"6Gr4AVmTax1pMJO0lHRK"],
];
const outDir=join(process.cwd(),"public","_practice-clips");

(async()=>{
  for(const [slug,words,voice] of JOBS){
    const path=`scripts/_sets/${slug}.json`;
    const exs:any[]=JSON.parse(readFileSync(path,"utf8"));
    for(const w of words){
      const e=exs.find(x=>x.payload?.audioClip?.sentence && strip(x.word||"")===strip(w));
      if(!e){ console.log(`  ?? no encontrado ${slug} :: ${w}`); continue; }
      const file=`${slug}__${strip(e.word).replace(/\s+/g,"-")}__t2.mp3`;
      let body:Buffer;
      try{ body=readFileSync(join(outDir,file)); }catch{ console.log(`  ?? falta take-2 ${file}`); continue; }
      const rev=(e.payload.audioClip.rev||0); // sin clipUrl previo => rev 0
      const key=clipKey(voice,e.payload.audioClip.sentence,rev);
      await uploadPublicObject({key,body,contentType:"audio/mpeg"});
      e.payload.audioClip.clipUrl=getPublicObjectUrl(key);
      console.log(`  ✓ ${slug} :: ${w} -> ${e.payload.audioClip.clipUrl}`);
    }
    writeFileSync(path, JSON.stringify(exs,null,2)+"\n");
  }
})();
