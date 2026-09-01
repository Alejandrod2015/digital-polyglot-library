import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import * as fs from "fs"; import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const J="cmtgelq560007j84n3ujx9bpd";
const CIUDAD: Record<string,string> = {
  "friends-and-reunions":"Rosario","staying-with-locals":"Salento","jokes-and-misunderstandings":"Medellín",
  "borders-and-crossings":"Santa Rosa","secrets-and-curiosity":"Arequipa","work-trips-and-meetings":"Guadalajara",
  "local-life-and-routines":"Mérida" };
(async()=>{
  const j=await p.journey.findUnique({where:{id:J},select:{topics:true,status:true}});
  const tops=await p.topic.findMany({where:{slug:{in:j!.topics}},select:{slug:true,label:true}});
  const lab=new Map(tops.map(t=>[t.slug,t.label]));
  const ss=await p.journeyStory.findMany({where:{journeyId:J},
    select:{id:true,topic:true,slotIndex:true,title:true,slug:true,text:true,vocab:true,audioUrl:true,coverUrl:true,status:true}});
  ss.sort((a,b)=>(j!.topics.indexOf(a.topic)-j!.topics.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  const prac=new Set((await p.storyPracticeSet.findMany({where:{storyId:{in:ss.map(s=>s.id)}},select:{storyId:true}})).map(x=>x.storyId));
  // bundles de glosas
  // Las glosas viven en la BASE desde el 2026-08-26 (`dp_tap_glosses_v1`), no
  // en `src/data/tapGlosses`. Esta tabla seguia leyendo el directorio viejo, que
  // ya no existe, asi que la columna daba 0 aunque las glosas estuvieran
  // escritas. Una tabla que informa de menos es tan falsa como una que informa
  // de mas. Ahora cuenta la CAPA DE CONTEXTO, que es la que hace que la glosa
  // diga lo que la palabra significa ahi: una fila por historia.
  const filasGlosa=await p.tapGlossSet.findMany({select:{slug:true,glosses:true}});
  const slugsBundle=new Set(
    filasGlosa.filter(r=>r.slug!=="" && Object.keys((r.glosses??{}) as object).length>0).map(r=>r.slug)
  );
  console.log("## tabla por temas\n");
  console.log("| # | Ciudad · Tema | Escritas+vocab | Glosas tap | Práctica | Audio | Cover |");
  console.log("|---|---|---|---|---|---|---|");
  let T=[0,0,0,0,0];
  j!.topics.forEach((t,i)=>{
    const g=ss.filter(s=>s.topic===t);
    const esc=g.filter(s=>String(s.text??"").trim() && ((s.vocab as any[])??[]).length>=20).length;
    const gl=g.filter(s=>s.slug&&slugsBundle.has(s.slug)).length;
    const pr=g.filter(s=>prac.has(s.id)).length;
    const au=g.filter(s=>s.audioUrl).length, co=g.filter(s=>s.coverUrl).length;
    T=[T[0]+esc,T[1]+gl,T[2]+pr,T[3]+au,T[4]+co];
    console.log(`| ${i+1} | ${CIUDAD[t]} · ${lab.get(t)} | ${esc}/3 | ${gl}/3 | ${pr}/3 | ${au}/3 | ${co}/3 |`);
  });
  console.log(`| | **journey** | **${T[0]}/21** | **${T[1]}/21** | **${T[2]}/21** | **${T[3]}/21** | **${T[4]}/21** |`);

  // ---- tabla por historias
  const conTexto=ss.filter(s=>String(s.text??"").trim());
  const tok=(t:string)=> new Set((t.toLowerCase().match(/\p{L}+/gu)??[]) as string[]);
  const cuerpos=conTexto.map(s=>tok(String(s.text)));
  const clave=(v:any)=>String(v.surface??v.word).toLowerCase();
  console.log("\n## tabla por historias\n");
  console.log("| # | Historia | Glosas | Portables | Ancladas | Vistas antes | Vuelven después | Escalera |");
  console.log("|---|---|---|---|---|---|---|---|");
  let n=0, esc:number[]=[];
  for (const s of ss) {
    n++;
    if (!String(s.text??"").trim()) { console.log(`| ${n} | (vacía) ${CIUDAD[s.topic]} #${s.slotIndex} | - | - | - | - | - | - |`); continue; }
    const idx=conTexto.findIndex(x=>x.id===s.id);
    const vs=((s.vocab as any[])??[]);
    const formas=new Set([...tok(String(s.text)), ...tok(String(s.title??""))]);
    const conGlosa=[...formas].filter(f=>slugsBundle.has(f)).length;
    let port=0,anc=0,antes=0,desp=0,suma=0;
    for (const v of vs) {
      const k=clave(v);
      const enCuales=cuerpos.map((c,i)=>c.has(k)?i:-1).filter(i=>i>=0);
      suma+=enCuales.length;
      if (enCuales.length>1) port++; else anc++;
      if (enCuales.some(i=>i<idx)) antes++;
      if (enCuales.some(i=>i>idx)) desp++;
    }
    const e=(suma/vs.length);
    esc.push(e);
    console.log(`| ${n} | [${s.title}](http://localhost:3000/stories/${s.slug}) | ${conGlosa}/${formas.size} | ${port} | ${anc} | ${antes} | ${desp} | ${e.toFixed(2)} |`);
  }
  const media=esc.length? esc.reduce((a,b)=>a+b,0)/esc.length : 0;
  console.log(`| | **journey** | | | | | | **${media.toFixed(2)}** |`);
})().finally(()=>p.$disconnect());
