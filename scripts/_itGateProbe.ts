import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { validateJourneyStories, type JourneyStoryInput } from "../src/lib/validateJourneyStories";
const prisma = new PrismaClient();
async function run(){
const id = process.argv[2] ?? "cmss0fkc40007j8dub1zpa1kc";
const level = process.argv[3] ?? "a0";
const j = await prisma.journey.findUnique({ where: { id }, select: { topics: true, language: true } });
const filas = (await prisma.journeyStory.findMany({ where: { journeyId: id }, select: { slug:true,title:true,text:true,vocab:true,topic:true,slotIndex:true } }))
  .sort((a,b)=>((j!.topics.indexOf(a.topic)-j!.topics.indexOf(b.topic))||(a.slotIndex-b.slotIndex)));
const todas: JourneyStoryInput[] = filas.filter(f=>f.text?.trim()).map(f=>({ slug:f.slug!, title:f.title!, text:f.text!, vocab:f.vocab as never, language:"italian", level }));
const realPeople = (await prisma.betaSignup.findMany({ select: { email: true } }))
  .flatMap(b=>String(b.email??"").split("@")[0].split(/[._\-+0-9]+/)).filter(w=>w.length>=3)
  .map(w=>w[0].toUpperCase()+w.slice(1).toLowerCase());
for (const c of validateJourneyStories(todas, { language: "italian", level, realPeople }))
  console.log(`${c.status==="pass"?"ok  ":c.status==="fail"?"FAIL":"SIN IMPL"} [${c.id}] ${c.detail ?? ""}`);
await prisma.$disconnect();
}
run();
