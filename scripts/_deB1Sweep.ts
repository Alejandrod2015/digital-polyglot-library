/** Barrido de las 21: primera y ultima oracion, forma de apertura, parrafos. Sin escritura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const J = "cmufhdbsj0007j8rotoym061z";
const first = (t:string) => { const p=t.split(/\n{2,}/)[0]??""; return (p.split(/(?<=[.!?])\s/)[0]??p).trim(); };
const last  = (t:string) => { const p=t.trim().split(/\n{2,}/).pop()??""; const s=p.split(/(?<=[.!?])\s/); return (s[s.length-1]??p).trim(); };
(async () => {
  const p = new PrismaClient();
  const j = await p.journey.findUnique({ where:{id:J}, select:{topics:true} });
  const ss = await p.journeyStory.findMany({ where:{journeyId:J}, select:{slug:true,text:true,topic:true,slotIndex:true,vocab:true} });
  ss.sort((a,b)=> j!.topics.indexOf(a.topic!)-j!.topics.indexOf(b.topic!) || a.slotIndex-b.slotIndex);
  const formas = new Map<string,number>(); const cierres = new Map<string,number>();
  ss.forEach((s,i)=>{
    const f = first(s.text||""), l = last(s.text||"");
    const w = f.split(/\s+/);
    let forma = "otra";
    if (/^(Der|Die|Das|Den|Dem)$/.test(w[0])) forma = "art.definido + sust";
    else if (/^(Ein|Eine|Einen|Einem|Einer)$/.test(w[0])) forma = "art.indefinido + sust";
    else if (/^(Zwei|Drei|Vier|Fünf|Sechs|Sieben|Kein|Keine|Keinen)$/.test(w[0])) forma = "cantidad/negacion + sust";
    else if (/^(Ich|Wir|Er|Sie|Es)$/.test(w[0])) forma = "pronombre";
    formas.set(forma,(formas.get(forma)||0)+1);
    const lw = l.split(/\s+/);
    let fc = "otro";
    if (/^(Lena|Bastian|Miriam|Tobias|Verena)[:,]?$/.test(lw[0])) fc = "nombre del reparto al inicio";
    else if (/^Ich\b/.test(l)) fc = "Ich (narradora)";
    cierres.set(fc,(cierres.get(fc)||0)+1);
    console.log(`${String(i+1).padStart(2)} ${s.topic!.slice(0,18).padEnd(18)}#${s.slotIndex} [${forma}]\n    1a: ${f}\n    ult: ${l}`);
  });
  console.log("\n=== FORMA DE LA PRIMERA ORACION ==="); for (const [k,v] of [...formas].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(2)}/21  ${k}`);
  console.log("=== FORMA DE LA ULTIMA ORACION ==="); for (const [k,v] of [...cierres].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(2)}/21  ${k}`);
  await p.$disconnect();
})();
