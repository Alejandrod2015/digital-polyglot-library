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
const STOP=new Set(("der die das ein eine einen einem einer eines und oder aber denn sondern nicht kein keine ist sind war waren sein hat habe haben hatte ich du er sie es wir ihr mich dich sich uns euch mein dein ihre seine unser von zu mit nach bei aus vor über unter auf an in im am zum zur als wie wenn dass weil dann noch schon nur auch sehr mehr man wer was wo hier dort jetzt heute immer nie oft doch ja nein bis durch für gegen ohne um seit dem den des dieser diese dieses jede jeder jedes alle alles etwas nichts viel viele wieder ganz ihm ihn wird werden kann können muss müssen will wollen soll sollen darf dürfen mag mögen dann sich einen").split(/\s+/));
(async()=>{
  const mio = await p.journey.findUnique({ where:{id:J}, select:{language:true, typeSlug:true}});
  const otras = await p.journeyStory.findMany({
    where:{ journey:{ language:mio!.language, status:{not:"archived"} }, journeyId:{not:J} },
    select:{ vocab:true, journey:{select:{typeSlug:true}} }});
  const duro=new Set<string>(), blando=new Set<string>();
  for(const r of otras){ const d = r.journey?.typeSlug===mio!.typeSlug ? duro : blando;
    for(const v of ((r.vocab as any[])??[])) if(v?.word) d.add(lema(String(v.word))); }
  const a0=JSON.parse(fs.readFileSync(process.env.SRC || "" + __dirname + "/de-a0-v2.json","utf8"));
  const first=new Map<string,number>();
  a0.forEach((s:any,i:number)=>{for(const v of (s.vocab??[])){const k=lema(v.word); if(!first.has(k)) first.set(k,i);}});
  const yaSlot=new Set<string>(); for(const s of a0) for(const v of (s.vocab??[])) yaSlot.add(lema(v.word));
  for(const arg of process.argv.slice(2)){
    const i=Number(arg)-1, s=a0[i];
    // Se queda si es su primera aparicion y no la ensena el A1. Ademas, el
    // tope contra OTROS tipos es 2 por historia, asi que a partir de la
    // tercera tambien se cae aunque sea legitima.
    let blandas = 0;
    const quedan: any[] = [], fuera: any[] = [];
    for (const v of s.vocab) {
      const k = lema(v.word);
      if (first.get(k) !== i || duro.has(k)) { fuera.push(v); continue; }
      if (blando.has(k)) { if (blandas >= 2) { fuera.push(v); continue; } blandas++; }
      quedan.push(v);
    }
    console.log(`(plazas de otro tipo conservadas: ${blandas}/2)`);
    console.log(`\n##### ${arg} ${s.title} · plazas ${s.vocab.length} · quedan ${quedan.length} · faltan ${Math.max(0,20-quedan.length)}`);
    console.log("QUEDAN:", quedan.map((v:any)=>v.word).join(" · "));
    console.log("FUERA:", fuera.map((v:any)=>v.word).join(" · "));
    const toks=[...new Set((String(s.text).match(/\p{L}+/gu)??[]))];
    const libres=toks.filter((t)=>{const k=lema(t.toLowerCase());
      return t.length>=4 && !STOP.has(t.toLowerCase()) && !yaSlot.has(k) && !duro.has(k) && !blando.has(k);});
    console.log("LIBRES:", libres.join(" "));
  }
  await p.$disconnect();
})();
