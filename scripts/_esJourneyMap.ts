import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const js = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true, topics: true, typeSlug: true,
      stories: { select: { id: true, status: true } } },
    orderBy: [{ language: "asc" }],
  });
  for (const j of js) {
    console.log(`${j.status.toUpperCase().padEnd(6)} ${j.id}  ${String(j.name).padEnd(14)} ${j.language}/${j.variant} ${JSON.stringify(j.levels)} type=${j.typeSlug} stories=${j.stories.length}`);
    console.log(`        topics: ${JSON.stringify(j.topics)}`);
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e.message); await p.$disconnect(); process.exit(1); });
