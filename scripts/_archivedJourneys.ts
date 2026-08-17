import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

async function main() {
  const journeys = await p.journey.findMany({
    where: { status: "archived" },
    select: { name: true, language: true, variant: true, createdAt: true, stories: { select: { status: true } } },
    orderBy: [{ language: "asc" }, { name: "asc" }, { variant: "asc" }],
  });
  console.log(`ARCHIVED journeys: ${journeys.length}\n`);
  for (const j of journeys) {
    const byS: Record<string, number> = {};
    for (const s of j.stories) byS[s.status] = (byS[s.status] || 0) + 1;
    const pub = byS["published"] || 0;
    const wip = j.stories.length - pub;
    const kind = pub === 0 && wip > 0 ? "DRAFT-puro" : pub > 0 && wip === 0 ? "todo-pub" : pub > 0 ? "mixto" : "vacío";
    const bd = Object.entries(byS).sort().map(([k, v]) => `${k}:${v}`).join(" ");
    console.log(`${j.name}\t${j.language}/${j.variant}\t${kind}\ttotal=${j.stories.length}\t[${bd}]\t${j.createdAt.toISOString().slice(0, 10)}`);
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
