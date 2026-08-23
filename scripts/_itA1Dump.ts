/** Vuelca el journey de la BASE al fichero de trabajo. La base es la verdad. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function run(){
  const id="cmt5wqsf7000032ghesowd0jy";
  // EN ORDEN DE LECTURA. `arctype-rotation` compara contra las hermanas ya
  // validadas de la tanda, asi que un volcado en el orden que devuelva la base
  // cambia la secuencia de arcos y hace fallar historias que estaban bien.
  const j=await prisma.journey.findUnique({where:{id},select:{topics:true}});
  const rows=(await prisma.journeyStory.findMany({where:{journeyId:id},
    select:{topic:true,slotIndex:true,title:true,slug:true,synopsis:true,text:true,vocab:true,arcType:true}}))
    .sort((a,b)=>(j!.topics.indexOf(a.topic)-j!.topics.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  fs.writeFileSync("scripts/_itA1/ALL.json", JSON.stringify(rows,null,1));
  console.log(`${rows.length} historias volcadas · ${rows.reduce((n,r)=>n+((r.vocab as any[])??[]).length,0)} plazas`);
  await prisma.$disconnect();
}
run();
