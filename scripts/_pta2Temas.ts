/** SOLO LECTURA. Temas (slug + label) de cada journey PT, para no repetirlos. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language: "portuguese" }, select: { id: true, levels: true, topics: true, status: true } });
  const slugs = [...new Set(js.flatMap(j => j.topics))];
  const ts = await p.topic.findMany({ where: { slug: { in: slugs } }, select: { slug: true, label: true } });
  const byslug = new Map(ts.map(t => [t.slug, t.label]));
  for (const j of js) {
    console.log(`\n${j.levels.join("/")} (${j.status}):`);
    for (const s of j.topics) console.log(`  ${s.padEnd(22)} ${byslug.get(s)}`);
  }
})().finally(() => p.$disconnect());
