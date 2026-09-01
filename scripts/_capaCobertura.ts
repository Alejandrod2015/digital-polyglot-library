import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { status: { in: ["active", "draft"] } }, select: { id: true, name: true, status: true, language: true, variant: true, levels: true } });
  const capa = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" } }, select: { slug: true, glosses: true } });
  const conC = new Set(capa.filter((f) => Object.values(f.glosses as Record<string, { c?: unknown }>).some((v) => v?.c)).map((f) => f.slug));
  const filas: string[] = [];
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { slug: true } });
    const n = st.filter((s) => s.slug && conC.has(s.slug)).length;
    filas.push(`${n === st.length && st.length ? "OK " : "   "}| ${j.name} ${j.language}/${j.variant} ${j.levels?.[0] ?? ""} | ${j.status} | ${n}/${st.length}`);
  }
  console.log(filas.sort().join("\n"));
  await p.$disconnect();
})();
