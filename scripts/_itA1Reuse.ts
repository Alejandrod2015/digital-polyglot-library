/**
 * Que diria `journey-portable-recirculation` sobre este journey: toda plaza
 * PORTABLE tiene que reaparecer en al menos otra historia; las ANCLADAS quedan
 * exentas. El check todavia no existe ni aqui ni en origin/main (2026-08-23,
 * vive en otro worktree), asi que esto solo mide.
 */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const PORT=new Set(["verb","adjective","adverb","expression"]);
async function run(){
  const id="cmt5wqsf7000032ghesowd0jy";
  const j=await prisma.journey.findUnique({where:{id},select:{topics:true}});
  const rows=(await prisma.journeyStory.findMany({where:{journeyId:id},select:{topic:true,slotIndex:true,slug:true,text:true,vocab:true}}))
    .sort((a,b)=>(j!.topics.indexOf(a.topic)-j!.topics.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]) as string[];
  const cuerpos=rows.map(r=>new Set(tok(r.text??"")));
  let port=0, anc=0; const huerfanas:string[]=[];
  rows.forEach((r,i)=>{
    for (const v of ((r.vocab as any[])??[])) {
      const f=String(v.surface??v.word).toLowerCase();
      const esPort = PORT.has(String(v.type).toLowerCase());
      if (esPort) {
        port++;
        const otras = cuerpos.filter((c,k)=>k!==i && c.has(f)).length;
        if (otras===0) huerfanas.push(`${i+1}:${f}`);
      } else anc++;
    }
  });
  console.log(`plazas ${port+anc} · portables ${port} (${(100*port/(port+anc)).toFixed(0)}%) · ancladas ${anc}`);
  console.log(`portables que NO reaparecen en otra historia: ${huerfanas.length}`);
  if (huerfanas.length) console.log("  " + huerfanas.join(" "));
  await prisma.$disconnect();
}
run();
