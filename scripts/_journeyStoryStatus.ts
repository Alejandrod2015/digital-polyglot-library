import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

async function main() {
  const journeys = await p.journey.findMany({
    select: { name: true, language: true, variant: true, status: true, stories: { select: { status: true } } },
    orderBy: [{ status: "asc" }, { language: "asc" }, { name: "asc" }],
  });
  for (const j of journeys) {
    if (j.status === "archived") continue; // NUNCA archived
    const byS: Record<string, number> = {};
    for (const s of j.stories) byS[s.status] = (byS[s.status] || 0) + 1;
    const pub = byS["published"] || 0;
    const draftish = j.stories.length - pub;
    const tag = pub > 0 && draftish === 0 ? "LIVE" : pub === 0 ? "DRAFT" : "MIXTO";
    console.log(`[${tag}] ${j.name} (${j.language}/${j.variant}) journey=${j.status} | total=${j.stories.length} | ${Object.entries(byS).map(([k, v]) => `${k}:${v}`).join(" ")}`);
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
