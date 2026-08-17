import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

async function main() {
  const rows = await p.journey.findMany({
    where: { status: { in: ["active", "archived"] } },
    select: { name: true, language: true, variant: true, status: true, levels: true, topics: true, storiesPerTopic: true, createdAt: true, _count: { select: { stories: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const fmt = (r: typeof rows[number]) =>
    `${r.status === "active" ? "LIVE " : "arch "} ${r.name} (${r.language}/${r.variant}) | niveles:${r.levels.length} temas:${r.topics.length} x${r.storiesPerTopic} = esperado ${r.levels.length * r.topics.length * r.storiesPerTopic} | historias:${r._count.stories} | ${r.createdAt.toISOString().slice(0, 10)}`;
  console.log("=== ACTIVE (estándar actual) ===");
  for (const r of rows.filter((r) => r.status === "active")) console.log(fmt(r));
  console.log("\n=== ARCHIVED ===");
  for (const r of rows.filter((r) => r.status === "archived")) console.log(fmt(r));
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
