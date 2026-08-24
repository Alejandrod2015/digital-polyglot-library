import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ex = await p.storyPracticeExercise.findMany({
    where: { set: { story: { journeyId: process.argv[2] } } },
    select: { type: true, setId: true },
  });
  const porTipo: Record<string, number> = {};
  const porSet: Record<string, number> = {};
  for (const e of ex) { porTipo[e.type] = (porTipo[e.type] ?? 0) + 1; porSet[e.setId] = (porSet[e.setId] ?? 0) + 1; }
  const tam = Object.values(porSet);
  console.log(`${ex.length} ejercicios en ${tam.length} sets · ${Math.min(...tam)}-${Math.max(...tam)} por set`);
  console.log(Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}`).join(" · "));
})().finally(() => p.$disconnect());
