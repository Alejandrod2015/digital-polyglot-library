import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const t = await p.topic.findMany({ where: { OR: [ { slug: { contains: "news" } }, { label: { contains: "News" } }, { label: { contains: "Headlines" } } ] } });
  for (const x of t) console.log(JSON.stringify(x));
  const js = await p.journey.findMany({ where: { topics: { hasSome: t.map(x=>x.slug) } }, select: { id: true, name: true, language: true, variant: true, levels: true, status: true, topics: true } });
  for (const j of js) console.log(`${j.status} ${j.language}/${j.variant} ${j.levels} usa: ${j.topics.filter(s=>t.some(x=>x.slug===s)).join(",")}`);
  await p.$disconnect();
})();
