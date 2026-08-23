/** ¿Se puede repartir el vocab del A0 sin tocar los cuerpos?
 *  Reparte cada lema limpio a UNA sola historia y comprueba las dos
 *  condiciones a la vez: 20 plazas por historia y la escalera de las
 *  portables. Solo lectura. */
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
  if (process.env.SIN_A1) duro.clear();
  const a0=JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-all.json","utf8"));
  const cuerpos = a0.map((s:any)=> new Set((String(s.text).toLowerCase().match(/\p{L}+/gu)??[]).map(lema)));
  // candidatos por historia
  const cand: string[][] = a0.map((s:any)=>{
    const l=new Set<string>();
    for(const t of (String(s.text).match(/\p{L}+/gu)??[])){ const k=lema(t.toLowerCase());
      if(t.length>=4 && !STOP.has(t.toLowerCase()) && !duro.has(k) && !blando.has(k)) l.add(k); }
    return [...l];
  });
  // encuentros: en cuantos cuerpos aparece el lema
  const enc = (k:string)=> cuerpos.filter((c:Set<string>)=>c.has(k)).length;
  const asignado = new Set<string>();
  const plan: string[][] = a0.map(()=>[]);
  // orden por escasez: primero la historia con menos candidatos
  const orden = cand.map((c,i)=>({i,n:c.length})).sort((a,b)=>a.n-b.n).map(x=>x.i);
  for (const i of orden) {
    // dentro de cada historia, primero los lemas que aparecen en MAS cuerpos:
    // los que salen en muchos sirven a cualquiera y conviene dejarlos para el final
    const libres = cand[i].filter(k=>!asignado.has(k)).sort((a,b)=>enc(b)-enc(a));
    for (const k of libres) { if (plan[i].length>=20) break; plan[i].push(k); asignado.add(k); }
  }
  let faltan=0; const todas: number[] = [];
  a0.forEach((s:any,i:number)=>{
    const e = plan[i].map(enc);
    todas.push(...e);
    if (plan[i].length<20) { faltan++; console.log(`CORTA ${i+1} ${s.title}: solo ${plan[i].length} plazas`); }
  });
  const port = todas.filter(n=>n>1), anc = todas.filter(n=>n<=1);
  const media = port.reduce((a,b)=>a+b,0)/(port.length||1);
  console.log(`historias que no llegan a 20: ${faltan}`);
  console.log(`plazas repartidas: ${todas.length}`);
  console.log(`ancladas (1 solo cuerpo): ${anc.length} (${Math.round(100*anc.length/todas.length)}%) · tope 30%`);
  console.log(`portables: ${port.length} · media ${media.toFixed(2)} · suelo 3.00`);
  // El techo real: cuantos lemas limpios aparecen en 2 o mas cuerpos. Una
  // plaza portable necesita justamente eso, asi que este numero es el maximo
  // de portables que el journey puede tener sin tocar los textos.
  const limpios = new Set<string>(); cand.forEach((c:string[])=>c.forEach((k:string)=>limpios.add(k)));
  const dosMas = [...limpios].filter((k)=>enc(k)>=2);
  const tresMas = [...limpios].filter((k)=>enc(k)>=3);
  console.log(`\nlemas limpios distintos: ${limpios.size}`);
  console.log(`  de esos, en 2+ cuerpos: ${dosMas.length}  (maximo de portables posible)`);
  console.log(`  de esos, en 3+ cuerpos: ${tresMas.length}`);
  console.log(`para cumplir el tope del 30% de ancladas sobre 420 plazas harian falta 294 portables`);
  await p.$disconnect();
})();
