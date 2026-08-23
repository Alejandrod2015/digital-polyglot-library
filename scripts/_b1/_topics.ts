import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ts = await p.topic.findMany({ orderBy: { slug: "asc" } });
  console.log(`${ts.length} temas en la tabla`);
  for (const t of ts) console.log(`  ${t.slug.padEnd(34)} ${t.label.padEnd(30)} universal=${t.isUniversal} sort=${t.sortOrder}`);
  const jt = await p.journeyType.findMany();
  console.log("\ntipos:", jt.map((x) => `${x.slug}=${x.label}`).join(" · "));
})().finally(() => p.$disconnect());
