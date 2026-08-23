import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function run(){
  const id="cmt5wqsf7000032ghesowd0jy";
  const j=await prisma.journey.findUnique({where:{id},select:{topics:true}});
  const rows=(await prisma.journeyStory.findMany({where:{journeyId:id},select:{topic:true,slotIndex:true,title:true,text:true}}))
    .sort((a,b)=>(j!.topics.indexOf(a.topic)-j!.topics.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  const [de,a]=[Number(process.argv[2]??1),Number(process.argv[3]??21)];
  rows.slice(de-1,a).forEach((r,k)=>{ console.log(`\n===== ${de+k} · ${r.title}`); console.log(r.text); });
  await prisma.$disconnect();
}
run();
