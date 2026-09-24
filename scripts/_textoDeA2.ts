import "./_loadEnv";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const s:any = await p.journeyStory.findFirst({ where:{ journeyId:'cmubidgaf0007j8np6g7n89iu', slug:process.argv[2] } });
  console.log(JSON.stringify({ titulo:s.title, parrafo:s.text.split(/\n\n+/)[0].trim(), topic:s.topic }, null, 1));
  await p.$disconnect();
})();
