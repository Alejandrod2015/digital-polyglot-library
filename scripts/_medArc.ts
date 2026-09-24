import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { status: "draft" }, select: { id: true, language: true, levels: true, variant: true,
    stories: { select: { arcType: true, synopsis: true, text: true, cast: true } } } });
  for (const j of js) {
    const con = j.stories.filter(s => (s.text ?? "").length > 200);
    const sinArc = con.filter(s => !s.arcType).length;
    const arcs = [...new Set(con.map(s => s.arcType).filter(Boolean))];
    const sinCast = con.filter(s => !s.cast || (Array.isArray(s.cast) && (s.cast as any).length === 0)).length;
    console.log(`${j.language}/${j.variant} ${j.levels[0]} n=${con.length} sinArcType=${sinArc} arcs=${arcs.join(",")||"-"} sinCast=${sinCast}`);
  }
})().finally(() => p.$disconnect());
