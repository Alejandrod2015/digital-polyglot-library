import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function run(){
  const id = "cmt5wqsf7000032ghesowd0jy";
  const j = await prisma.journey.findUnique({ where: { id }, select: { topics: true } });
  const rows = (await prisma.journeyStory.findMany({ where: { journeyId: id },
    select: { topic:true, slotIndex:true, title:true, slug:true, wordCount:true, vocabCount:true, arcType:true, text:true, status:true } }))
    .sort((a,b)=>(j!.topics.indexOf(a.topic)-j!.topics.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  const et: Record<string,string> = {};
  for (const t of await prisma.topic.findMany({ where: { slug: { in: j!.topics } }, select: { slug:true,label:true } })) et[t.slug]=t.label;
  const quien = (t:string)=>{
    const n = ["Irene","Marta","Gaia","Dario","Martina","Nico"].find(x=>t.includes(x));
    return n ?? "";
  };
  console.log("| # | tema | historia | pal | voc | arco | invitado |");
  console.log("|---|---|---|---|---|---|---|");
  rows.forEach((r,i)=>{
    console.log(`| ${i+1} | ${et[r.topic] ?? r.topic} | ${r.title} | ${r.wordCount} | ${r.vocabCount} | ${r.arcType} | ${quien(r.text ?? "")} |`);
  });
  await prisma.$disconnect();
}
run();
