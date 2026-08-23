/** Encadena el A0 Traveler italy con el A1: al terminar las 21, la app ofrece el siguiente. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function run(){
  const A0="cmss0fkc40007j8dub1zpa1kc", A1="cmt5wqsf7000032ghesowd0jy";
  await prisma.journey.update({ where: { id: A0 }, data: { nextJourneyId: A1 } });
  const js = await prisma.journey.findMany({ where: { language: "italian", status: { not: "archived" } },
    select: { id:true,name:true,levels:true,status:true,nextJourneyId:true,
      stories: { select: { status:true, wordCount:true, vocabCount:true } } } });
  for (const j of js) {
    const pub = j.stories.filter(s=>s.status==="published").length;
    console.log(`${j.name.padEnd(10)} ${JSON.stringify(j.levels).padEnd(8)} ${j.status.padEnd(9)} historias=${j.stories.length} publicadas=${pub} next=${j.nextJourneyId ?? "-"}`);
  }
  await prisma.$disconnect();
}
run();
