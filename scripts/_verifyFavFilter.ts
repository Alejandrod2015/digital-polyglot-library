import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const JP="journey-";
(async()=>{
  const salz=await p.favorite.findFirst({where:{word:"salzig"},select:{userId:true}});
  const favs=await p.favorite.findMany({where:{userId:salz?.userId},select:{word:true,storySlug:true}});
  const pseudoIds:string[]=[], plain:string[]=[];
  for(const f of favs){ if(!f.storySlug)continue; f.storySlug.startsWith(JP)?pseudoIds.push(f.storySlug.slice(JP.length)):plain.push(f.storySlug); }
  const LIVE={status:{notIn:["archived","draft"]}};
  const live=new Set<string>();
  const jr1=await p.journeyStory.findMany({where:{id:{in:pseudoIds},status:"published",journey:LIVE},select:{id:true}});
  for(const r of jr1) live.add(JP+r.id);
  const jr2=await p.journeyStory.findMany({where:{slug:{in:plain},status:"published",journey:LIVE},select:{slug:true}});
  for(const r of jr2) if(r.slug) live.add(r.slug);
  const sr=await p.standaloneStory.findMany({where:{slug:{in:plain}},select:{slug:true}});
  for(const r of sr) if(r.slug) live.add(r.slug);
  let kept=0, excluded=0, noSlug=0;
  for(const f of favs){ if(!f.storySlug){noSlug++;kept++;continue;} if(live.has(f.storySlug))kept++; else excluded++; }
  console.log(`favoritos: ${favs.length}`);
  console.log(`  MANTENIDOS (vivos + sin-slug): ${kept}`);
  console.log(`  EXCLUIDOS (huérfanos): ${excluded}`);
  console.log(`  (de los mantenidos, ${noSlug} son sin storySlug)`);
  // confirmar que salzig/Bissen (historia borrada) quedan EXCLUIDOS
  for(const w of ["salzig","Bissen"]){ const f=favs.find(x=>x.word===w); const ex=f&&f.storySlug&&!live.has(f.storySlug); console.log(`  ${w}: ${ex?"EXCLUIDO ✓ (huérfano)":"mantenido"}`); }
})().finally(()=>p.$disconnect());
