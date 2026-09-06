import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const CIUDADES = /\b(Madrid|Barcelona|Sevilla|Valencia|Granada|M[áa]laga|Bilbao|Nerja|Frigiliana|Marbella|Alicante|C[óo]rdoba|Toledo|Salamanca|San Sebasti[áa]n|Ronda|C[áa]diz|Almer[íi]a)\b/g;
(async () => {
  for (const [n, id] of [["A1", "cmsvz6mz9000732gsgsfer0ko"], ["A2", "cmt70xfyt000l3283gxd70wck"], ["B1", "cmt5x67ze000l320cpgunu5vi"]] as const) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: id }, select: { text: true, title: true } });
    const c: Record<string, number> = {};
    for (const s of ss) for (const m of `${s.title} ${s.text}`.match(CIUDADES) ?? []) c[m] = (c[m] ?? 0) + 1;
    console.log(n, JSON.stringify(c));
  }
  await p.$disconnect();
})();
