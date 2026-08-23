/** La escalera medida como la mide el gate: la plaza cuenta un encuentro
 *  cuando el TOKEN EXACTO de su `surface` aparece en el cuerpo. Sin lematizar.
 *  Mi cuenta anterior lematizaba, que no es lo que hace el gate. */
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
(async()=>{
  const mio = await p.journey.findUnique({ where:{id:J}, select:{language:true, typeSlug:true}});
  const otras = await p.journeyStory.findMany({
    where:{ journey:{ language:mio!.language, status:{not:"archived"} }, journeyId:{not:J} },
    select:{ vocab:true, journey:{select:{typeSlug:true}} }});
  const duro=new Set<string>(), blando=new Set<string>();
  for(const r of otras){ const d = r.journey?.typeSlug===mio!.typeSlug ? duro : blando;
    for(const v of ((r.vocab as any[])??[])) if(v?.word) d.add(lema(String(v.word))); }
  const a0=JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-all.json","utf8"));
  const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]);
  const cuerpos = a0.map((s:any)=> new Set(tok(String(s.text))));
  const encTok=(t:string)=> cuerpos.filter((c:Set<string>)=>c.has(t)).length;

  // control: la escalera de HOY, con el criterio del gate
  const hoy:number[]=[];
  for(const s of a0) for(const v of (s.vocab??[])) hoy.push(encTok(String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das)\s+/,"")));
  console.log(`control · escalera de hoy: media ${(hoy.reduce((a,b)=>a+b,0)/hoy.length).toFixed(2)} sobre ${hoy.length} plazas`);

  // techo real: tokens limpios por cuerpo, con su numero de encuentros
  const porEnc: Record<number, Set<string>> = {};
  const candPorHistoria: string[][] = a0.map((s:any)=>{
    const out:string[]=[];
    for(const t of new Set(tok(String(s.text)))){
      if(t.length<4 || STOP.has(t)) continue;
      const k=lema(t);
      if(duro.has(k)||blando.has(k)) continue;
      out.push(t);
      const e=encTok(t); (porEnc[Math.min(e,5)] ??= new Set()).add(t);
    }
    return out;
  });
  console.log("\ntokens limpios distintos por numero de cuerpos en que salen:");
  for(const k of Object.keys(porEnc).sort()) console.log(`  ${k==="5"?"5+":k} cuerpo(s): ${porEnc[Number(k)].size}`);
  console.log("\ncandidatos limpios por historia:", candPorHistoria.map(c=>c.length).join(" "));
  await p.$disconnect();
})();
