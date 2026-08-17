import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const js = await p.journey.findMany({ where: { status: { in: ["active","draft"] } }, select: { name: true, language: true, variant: true, status: true, topics: true } });
  const use = new Map<string, string[]>();
  for (const j of js) for (const t of j.topics) {
    const k = `${j.name} ${j.language}/${j.variant} [${j.status}]`;
    use.set(t, [...(use.get(t) ?? []), k]);
  }
  const rows = await p.topic.findMany({ select: { slug: true, label: true } });
  const have = new Map(rows.map((r: any) => [r.slug.toLowerCase(), r.label]));
  console.log("=== SLUGS COMPARTIDOS POR VARIOS JOURNEYS ===");
  for (const [slug, users] of [...use.entries()].sort()) {
    if (users.length > 1) console.log(`  ${slug.padEnd(26)} -> ${users.join("  |  ")}`);
  }
  console.log("\n=== FILAS Topic EXISTENTES ===");
  let ex = 0, miss = 0;
  for (const slug of [...use.keys()].sort()) have.has(slug) ? ex++ : miss++;
  console.log(`  con fila: ${ex}   sin fila: ${miss}   (total slugs distintos: ${use.size})`);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
