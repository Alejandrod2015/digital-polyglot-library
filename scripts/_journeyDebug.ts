import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const journeys = await prisma.journey.findMany({ where:{ status:"active" }, select:{ id:true, name:true, language:true, levels:true } }) as any[];
  console.log("active journeys devueltos:", journeys.length, "=>", journeys.map(j=>`${j.language}/${j.name}`).join(", "));
  for (const j of journeys) {
    try {
      const pub = await prisma.journeyStory.count({ where:{ journeyId:j.id, status:"published" } });
      const cover = await prisma.journeyStory.count({ where:{ journeyId:j.id, status:"published", coverUrl:{ not:null } } });
      const practice = await prisma.journeyStory.count({ where:{ journeyId:j.id, status:"published", practiceSet:{ isNot:null } } });
      console.log(`OK  ${j.language}/${j.name}: pub=${pub} cover=${cover} practice=${practice} levels=${JSON.stringify(j.levels)}`);
    } catch(e:any) { console.log(`ERR ${j.language}/${j.name}: ${e.message?.slice(0,100)}`); }
  }
})().finally(() => prisma.$disconnect());
