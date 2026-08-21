import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const hasJson = (s: string) => fs.existsSync(`scripts/_sets/${s}.json`);
(async () => {
  const sets = await prisma.storyPracticeSet.findMany({
    include: { story: { select: { slug: true, journey: { select: { status: true } } } },
      exercises: { select: { type: true, word: true, featured: true, payload: true } } },
  });
  const acc = { feat: 0, featRend: 0, pool: 0, poolRend: 0, cross: 0, json: 0, db: 0, sets: new Set<string>() };
  for (const s of sets) {
    if (s.story.journey?.status === "archived") continue;
    const g = new Map<string, any[]>();
    for (const e of s.exercises) {
      const a = (e.payload as any)?.audioClip;
      if (a?.sentence) g.set(a.sentence, [...(g.get(a.sentence) ?? []), e]);
    }
    for (const [, v] of g) {
      if (v.length < 2) continue;
      const F = v.filter((e) => e.featured), P = v.filter((e) => !e.featured);
      const rend = (xs: any[]) => xs.filter((e) => (e.payload as any)?.audioClip?.clipUrl).length;
      if (F.length > 1) { acc.feat += F.length - 1; acc.featRend += Math.max(0, rend(F) - 1); }
      if (P.length > 1) { acc.pool += P.length - 1; acc.poolRend += Math.max(0, rend(P) - 1); }
      if (F.length >= 1 && P.length >= 1) acc.cross++;
      const real = (F.length > 1 ? F.length - 1 : 0) + (P.length > 1 ? P.length - 1 : 0);
      if (real) { acc.sets.add(s.story.slug!); if (hasJson(s.story.slug!)) acc.json += real; else acc.db += real; }
    }
  }
  console.log(`REPETICION REALMENTE AUDIBLE (misma respuesta del API):`);
  console.log(`  dentro de los 10 featured: ${acc.feat} (ya renderizados: ${acc.featRend})`);
  console.log(`  dentro del pool:           ${acc.pool} (ya renderizados: ${acc.poolRend})`);
  console.log(`  TOTAL audible:             ${acc.feat + acc.pool} en ${acc.sets.size} sets  | con JSON ${acc.json} | solo DB ${acc.db}`);
  console.log(`  grupos featured<->pool (NUNCA coinciden en una sesion): ${acc.cross}`);
  await prisma.$disconnect();
})();
