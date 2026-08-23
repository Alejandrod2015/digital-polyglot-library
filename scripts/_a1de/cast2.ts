import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journey: { status: { not: "archived" } } },
    select: { slug: true, cast: true, journey: { select: { name: true, language: true, variant: true, levels: true } } },
  });
  const conCast = rows.filter((r) => r.cast && JSON.stringify(r.cast) !== "null" && JSON.stringify(r.cast) !== "{}");
  const byJ = new Map<string, number>();
  for (const r of conCast) {
    const k = `${r.journey?.name} ${r.journey?.language}/${r.journey?.variant} ${JSON.stringify(r.journey?.levels)}`;
    byJ.set(k, (byJ.get(k) ?? 0) + 1);
  }
  console.log(`historias con cast poblado: ${conCast.length} de ${rows.length}`);
  for (const [k, v] of [...byJ].sort((a,b)=>b[1]-a[1])) console.log(`  ${k}  ${v}`);
  if (conCast[0]) console.log("\nejemplo:", conCast[0].slug, JSON.stringify(conCast[0].cast).slice(0,320));
  await p.$disconnect();
})();
