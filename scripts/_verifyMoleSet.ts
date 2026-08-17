import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const set = await prisma.storyPracticeSet.findFirst({ where: { story: { slug: "la-promesa-del-mole" } }, include: { exercises: { where: { featured: true }, orderBy: { orderIndex: "asc" } } } });
  for (const e of set!.exercises) { const p:any=e.payload; if(e.type==="match_meaning")continue; console.log(`${e.word.padEnd(18)} → ${p.answer}`); }
  await prisma.$disconnect();
})();
