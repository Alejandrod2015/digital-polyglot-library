import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const lema=(w:string)=>w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const PALABRAS=["reproche","disculpa","promesa","aniversario","enterarse","cuaderno","pagina","apunte","letra","margen","foto","taller","patio","cena","cifra","deuda","amistad","plan","viaje","version","razon"];
(async()=>{
  const J="cmtgelq560007j84n3ujx9bpd";
  const rows=await p.journeyStory.findMany({where:{journey:{is:{language:"spanish",status:{not:"archived"}}}},select:{vocab:true,journeyId:true,topic:true,journey:{select:{name:true,variant:true,levels:true,typeSlug:true}}}});
  const origen=new Map<string,string[]>();
  for(const r of rows){
    const own=r.journeyId===J;
    if(!own && r.journey?.typeSlug!=="traveler") continue;
    const et= own ? "LAS 21 APARCADAS de este journey" : `${r.journey!.variant}/${(r.journey!.levels??[]).join(",")}`;
    for(const v of ((r.vocab as any[])??[])) if(v?.word){ const l=lema(String(v.word)); if(!origen.has(l))origen.set(l,[]); if(!origen.get(l)!.includes(et))origen.get(l)!.push(et); }
  }
  let soloAparcadas=0;
  for(const w of PALABRAS){ const o=origen.get(w);
    const solo = o && o.length===1 && o[0].startsWith("LAS 21");
    if(solo) soloAparcadas++;
    console.log(`${w.padEnd(14)} ${o? o.join(" + ") : "LIBRE"}${solo?"   <- se desbloquearia":""}`); }
  console.log(`\nde las ${PALABRAS.length} palabras del brief, ${soloAparcadas} las bloquean SOLO las 21 aparcadas`);
})().finally(()=>p.$disconnect());
