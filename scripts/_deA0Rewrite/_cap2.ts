/** Tope de 2 historias por palabra, en vez de nueve. Rellena hasta el suelo de
 *  20 con tokens limpios del propio cuerpo, prefiriendo los que mas recirculan,
 *  y mide la escalera con el criterio EXACTO del gate. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const SEP=["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"], COM=["ge","ver","be","er","ent"], ART=["der ","die ","das "];
function sp(w:string){let l=w.toLowerCase();for(const a of ART)if(l.startsWith(a)){l=l.slice(a.length);break;}
  for(const q of [...SEP,...COM])if(l.startsWith(q)&&l.length>q.length+3)return l.slice(q.length);return l;}
const lema=(w:string)=>sp(w).normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const J="cmt0a8vb1000m32p1x7r5ba28";
const STOP=new Set(("der die das ein eine einen einem einer eines und oder aber denn sondern nicht kein keine ist sind war waren sein hat habe haben hatte ich du er sie es wir ihr mich dich sich uns euch mein dein ihre seine unser von zu mit nach bei aus vor über unter auf an in im am zum zur als wie wenn dass weil dann noch schon nur auch sehr mehr man wer was wo hier dort jetzt heute immer nie oft doch ja nein bis durch für gegen ohne um seit dem den des dieser diese dieses jede jeder jedes alle alles etwas nichts viel viele wieder ganz ihm ihn wird werden kann können muss müssen will wollen soll sollen darf dürfen mag mögen").split(/\s+/));
const TOPE = Number(process.env.TOPE ?? 2);
(async()=>{
  const mio = await p.journey.findUnique({ where:{id:J}, select:{language:true, typeSlug:true}});
  const otras = await p.journeyStory.findMany({
    where:{ journey:{ language:mio!.language, status:{not:"archived"} }, journeyId:{not:J} },
    select:{ vocab:true, journey:{select:{typeSlug:true}} }});
  const duro=new Set<string>(), blando=new Set<string>();
  for(const r of otras){ const d = r.journey?.typeSlug===mio!.typeSlug ? duro : blando;
    for(const v of ((r.vocab as any[])??[])) if(v?.word) d.add(lema(String(v.word))); }
  if (process.env.SIN_A1) duro.clear();
  const a0=JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-all.json","utf8"));
  const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]);
  const cuerpos=a0.map((s:any)=>new Set(tok(String(s.text))));
  const clave=(x:string)=>x.toLowerCase().replace(/^(der|die|das)\s+/,"");
  const enc=(x:string)=>cuerpos.filter((c:Set<string>)=>c.has(clave(x))).length;

  const usos=new Map<string,number>();
  const nuevo: Array<Array<{word:string;surface:string;nueva:boolean}>> = a0.map(()=>[]);
  // 1) lo que sobrevive: sin choque con el A1 y sin pasar del tope
  a0.forEach((s:any,i:number)=>{
    for(const v of (s.vocab??[])){
      const k=lema(v.word);
      if(duro.has(k)) continue;
      if((usos.get(k)??0)>=TOPE) continue;
      usos.set(k,(usos.get(k)??0)+1);
      nuevo[i].push({word:v.word, surface:String(v.surface ?? v.word), nueva:false});
    }
  });
  // 2) relleno hasta 20, primero los tokens que mas recirculan
  a0.forEach((s:any,i:number)=>{
    const cands=[...new Set(tok(String(s.text)))]
      .filter(t=>t.length>=4 && !STOP.has(t) && !duro.has(lema(t)) && !blando.has(lema(t)))
      .sort((a,b)=>enc(b)-enc(a));
    for(const t of cands){
      if(nuevo[i].length>=20) break;
      const k=lema(t);
      if((usos.get(k)??0)>=TOPE) continue;
      usos.set(k,(usos.get(k)??0)+1);
      nuevo[i].push({word:t, surface:t, nueva:true});
    }
  });
  const todas:number[]=[]; let cortas=0, nuevas=0;
  a0.forEach((s:any,i:number)=>{
    if(nuevo[i].length<20){ cortas++; console.log(`CORTA ${i+1} ${s.title}: ${nuevo[i].length}`); }
    for(const v of nuevo[i]){ todas.push(enc(v.surface)); if(v.nueva) nuevas++; }
  });
  fs.writeFileSync("" + __dirname + "/de-a0-plan.json", JSON.stringify(nuevo,null,1));
  a0.forEach((s:any,i:number)=>{
    const ns=nuevo[i].filter(v=>v.nueva);
    console.log(`\n### ${i+1} ${s.title} · sobreviven ${nuevo[i].length-ns.length} · nuevas ${ns.length}`);
    console.log("NUEVAS:", ns.map(v=>`${v.surface}(${enc(v.surface)})`).join(" "));
  });
  const media=todas.reduce((a,b)=>a+b,0)/todas.length;
  const unaVez=todas.filter(n=>n<=1).length;
  const repetidas=[...usos.values()].filter(n=>n>1).length;
  console.log(`\ntope ${TOPE} por palabra${process.env.SIN_A1?" · sin la restriccion del A1":""}`);
  console.log(`plazas ${todas.length} · palabras distintas ${usos.size} · con dos plazas ${repetidas}`);
  console.log(`plazas nuevas que habria que glosar: ${nuevas}`);
  console.log(`historias por debajo de 20: ${cortas}`);
  console.log(`ESCALERA media ${media.toFixed(2)} (suelo 3.00) · ${unaVez}/${todas.length} salen una sola vez`);
  await p.$disconnect();
})();
