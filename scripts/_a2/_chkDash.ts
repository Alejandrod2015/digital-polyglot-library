import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmt70xfyt000l3283gxd70wck" }, select: { slug: true, title: true, text: true, synopsis: true, vocab: true } });
  let n = 0;
  for (const s of st) { const blob = JSON.stringify(s); if (/[\u2014\u2013]/.test(blob)) { console.log("GUION LARGO:", s.slug); n++; } }
  console.log(n === 0 ? "limpio: 0 guiones largos en las 21" : `${n} historias con guion largo`);
})().finally(() => p.$disconnect());
