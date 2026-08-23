import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.topic.findMany({ where: { slug: { in: ["madrid","barcelona","sevilla","valencia","bilbao","granada","san-sebastian","going-out"] } }, select: { slug: true, label: true } });
  for (const r of rows) console.log(r.slug.padEnd(16), "->", r.label);
})().finally(() => p.$disconnect());
