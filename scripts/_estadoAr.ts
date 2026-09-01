import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findFirst({ where: { language: "spanish", variant: "argentina", levels: { has: "c1" } }, select: { id: true, name: true } });
  const st = await p.journeyStory.findMany({ where: { journeyId: j!.id }, select: { slug: true, title: true, topic: true }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
  const capa = await p.tapGlossSet.findMany({ where: { slug: { in: st.map((s) => s.slug!) } }, select: { bundle: true, slug: true, glosses: true } });
  const conC = new Set(capa.filter((f) => Object.values(f.glosses as Record<string, { c?: unknown }>).some((v) => v?.c)).map((f) => f.slug));
  console.log("bundle:", [...new Set(capa.map((c) => c.bundle))].join(","));
  let n = 0;
  for (const s of st) { const ok = conC.has(s.slug!); if (ok) n++; console.log(`${ok ? "OK  " : "--> "} ${s.topic} | ${s.slug}`); }
  console.log(`\n${n}/${st.length} con capa`);
  await p.$disconnect();
})();
