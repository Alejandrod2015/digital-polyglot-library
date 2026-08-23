import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const slugs = ["food-everyday-life","home-family","meeting-new-people","places-getting-around","community-celebrations","nature-adventure","legends-folklore"];
  const t = await p.topic.findMany({ where: { slug: { in: slugs } }, select: { slug: true, label: true, isUniversal: true } });
  const bySlug = new Map(t.map((x) => [x.slug, x]));
  for (const s of slugs) {
    const r = bySlug.get(s);
    console.log(`${s.padEnd(24)} label="${r?.label ?? "(no existe fila)"}" universal=${r?.isUniversal ?? "-"}`);
  }
  // cuantos journeys usan cada slug
  const js = await p.journey.findMany({ where: { status: { not: "archived" } }, select: { name: true, language: true, variant: true, topics: true } });
  console.log("\nreutilizacion del slug en otros journeys vivos:");
  for (const s of slugs) {
    const users = js.filter((j) => j.topics.includes(s)).map((j) => `${j.name} ${j.language}/${j.variant}`);
    console.log(`  ${s.padEnd(24)} ${users.length ? users.join(" · ") : "solo este"}`);
  }
  await p.$disconnect();
})();
