/** Mira un set de practica ya construido. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { slug: process.argv[2] }, include: { practiceSet: { include: { exercises: { orderBy: { orderIndex: "asc" } } } } } });
  const raw = (s?.practiceSet as unknown as Record<string, unknown>) ?? {};
  const ex = (raw.exercises as Array<Record<string, unknown>>) ?? [];
  console.log(`${ex.length} ejercicios · audioUrl con valor: ${ex.filter((e) => e.audioUrl).length}`);
  const porTipo: Record<string, number> = {};
  for (const e of ex) porTipo[String(e.type)] = (porTipo[String(e.type)] ?? 0) + 1;
  console.log(Object.entries(porTipo).map(([k, v]) => `${k} ${v}`).join(" · ") + "\n");
  const feat = ex.filter((e) => e.featured);
  console.log(`featured ${feat.length}, pool ${ex.length - feat.length}\n`);
  for (const e of feat.slice(0, 6)) {
    const pl = e.payload as Record<string, unknown>;
    console.log(`  [${e.type}] ${e.word}  ${String(e.sentence).slice(0, 62)}`);
    if (pl.options) console.log(`      ${JSON.stringify(pl.options)} -> ${JSON.stringify(pl.answer)}`);
    if (pl.pairs) console.log(`      pares ${JSON.stringify(pl.pairs).slice(0, 90)}`);
  }
})().finally(() => p.$disconnect());
