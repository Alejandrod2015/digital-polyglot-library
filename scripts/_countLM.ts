import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const js = await p.journey.findMany({
    where: { status: "active" },
    select: { name: true, language: true, variant: true,
      stories: { where: { status: "published" }, select: { practiceSet: { select: { exercises: { select: { type: true, payload: true } } } } } } },
    orderBy: [{ language: "asc" }, { name: "asc" }],
  });
  let totL = 0, totM = 0;
  for (const j of js) {
    let L = 0, M = 0;
    for (const s of j.stories) for (const ex of s.practiceSet?.exercises ?? []) {
      if (ex.type === "listen_choose") L++;
      if (ex.type === "match_meaning") {
        const pairs = (ex.payload as any)?.pairs;
        M += Array.isArray(pairs) ? pairs.length : 0; // 1 clip de palabra por par
      }
    }
    totL += L; totM += M;
    console.log(`${j.name} (${j.language}/${j.variant}): listen=${L} · match-pairs=${M}`);
  }
  console.log(`\nTOTAL listen=${totL} · match-clips=${totM} · GRAN TOTAL=${totL + totM}`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
