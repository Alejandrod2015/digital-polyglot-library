import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

async function main() {
  const journeys = await p.journey.findMany({
    where: { status: "active" },
    select: { name: true, language: true, variant: true,
      stories: { where: { status: "published" }, select: { practiceSet: { select: { exercises: { select: { type: true, payload: true } } } } } } },
    orderBy: [{ language: "asc" }, { name: "asc" }],
  });
  for (const j of journeys) {
    const picks: { sent: string; url: string }[] = [];
    for (const s of j.stories) {
      for (const ex of s.practiceSet?.exercises ?? []) {
        if (ex.type !== "fill_blank" || picks.length >= 3) continue;
        const ac = (ex.payload as Record<string, unknown> | null)?.audioClip as Record<string, unknown> | undefined;
        const url = typeof ac?.clipUrl === "string" ? ac.clipUrl : "";
        const sent = typeof ac?.sentence === "string" ? ac.sentence : "";
        if (url && sent) picks.push({ sent, url });
      }
      if (picks.length >= 3) break;
    }
    for (const pk of picks) console.log(`${j.name}|${j.language}\t${pk.sent}\t${pk.url}`);
  }
  console.log("=== ARCHIVED ===");
  const arch = await p.journey.findMany({ where: { status: "archived" }, select: { name: true, language: true, variant: true, _count: { select: { stories: true } } }, orderBy: [{ language: "asc" }, { name: "asc" }] });
  for (const a of arch) console.log(`ARCH\t${a.name}\t${a.language}/${a.variant}\t${a._count.stories} hist`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
