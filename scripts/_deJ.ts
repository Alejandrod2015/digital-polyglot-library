import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const js = await p.journey.findMany({ where: { language: "german" },
    select: { id:true,name:true,levels:true,variant:true,status:true,city:true,cityMode:true,topics:true,typeSlug:true,nextJourneyId:true } });
  const allSlugs = [...new Set(js.flatMap(j=>j.topics))];
  const tl = await p.topic.findMany({ where: { slug: { in: allSlugs } }, select:{slug:true,label:true} });
  const m = new Map(tl.map(t=>[t.slug,t.label]));
  for (const j of js) {
    console.log(`${j.status.padEnd(9)} ${j.levels.join(",").padEnd(4)} ${j.name.padEnd(9)} var=${(j.variant||"-").padEnd(9)} type=${j.typeSlug} city=${j.city}/${j.cityMode} id=${j.id} next=${j.nextJourneyId}`);
    console.log("   " + j.topics.map(s=>m.get(s)||s).join(" | "));
  }
  await p.$disconnect();
})();
