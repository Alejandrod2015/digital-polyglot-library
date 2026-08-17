import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const TYPES = ["meaning_in_context", "fill_blank", "listen_choose", "match_meaning"] as const;

async function main() {
  const journeys = await p.journey.findMany({
    where: { status: "active" },
    select: {
      name: true, language: true, variant: true,
      stories: { where: { status: "published" }, select: { practiceSet: { select: { exercises: { select: { type: true, payload: true } } } } } },
    },
    orderBy: [{ language: "asc" }, { name: "asc" }],
  });

  for (const j of journeys) {
    // por tipo: total, #clipUrl (oración), #wordClipUrl (palabra)
    const agg: Record<string, { n: number; clip: number; word: number }> = {};
    for (const t of TYPES) agg[t] = { n: 0, clip: 0, word: 0 };
    for (const s of j.stories) for (const ex of s.practiceSet?.exercises ?? []) {
      const a = agg[ex.type]; if (!a) continue;
      a.n++;
      const ac = (ex.payload as Record<string, unknown> | null)?.audioClip as Record<string, unknown> | undefined;
      if (typeof ac?.clipUrl === "string" && ac.clipUrl) a.clip++;
      if (typeof ac?.wordClipUrl === "string" && ac.wordClipUrl) a.word++;
      // match: los clips de palabra viven en pairs, no en audioClip → contarlos aparte
      if (ex.type === "match_meaning") {
        const pairs = ((ex.payload as Record<string, unknown> | null)?.pairs ?? []) as Array<Record<string, unknown>>;
        for (const pr of pairs) if (typeof pr?.wordClipUrl === "string" && pr.wordClipUrl) a.word++;
      }
    }
    console.log(`\n### ${j.name} (${j.language}/${j.variant})`);
    for (const t of TYPES) {
      const a = agg[t];
      if (a.n === 0) continue;
      console.log(`  ${t}: ${a.n} ej | clip-oración: ${a.clip} | clip-palabra: ${a.word}`);
    }
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
