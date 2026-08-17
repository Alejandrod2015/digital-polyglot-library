/**
 * Runs the canonical validator's `body-non-native-character` check over every
 * live + draft journey story and prints the offenders.
 *
 * Diagnostic only: reads the DB, writes nothing. Feed it the JSON produced by
 * `_dumpCatalogForNativeAudit.ts`, or let it query directly.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

// Neutraliza el guard `server-only`, igual que scripts/saveStory.ts.
import { createRequire } from "module";
const __req = createRequire(__filename);
try {
  const p = __req.resolve("server-only");
  (__req as unknown as { cache: Record<string, unknown> }).cache[p] = {
    id: p, filename: p, loaded: true, exports: {},
  };
} catch { /* noop */ }

import { PrismaClient } from "../src/generated/prisma";
import { validateGeneratedStory } from "../src/lib/validateGeneratedStory";

const LANG_ISO: Record<string, string> = {
  spanish: "ES",
  german: "DE",
  italian: "IT",
  portuguese: "PT",
  french: "FR",
};

async function run() {
  const prisma = new PrismaClient();
  const journeys = await prisma.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: {
      id: true, name: true, language: true, variant: true, levels: true, status: true,
      stories: {
        select: { slug: true, title: true, synopsis: true, text: true, arcType: true, level: true, topic: true, slotIndex: true },
        orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
      },
    },
    orderBy: [{ language: "asc" }, { name: "asc" }],
  });

  let totalFail = 0;
  for (const j of journeys) {
    const iso = LANG_ISO[j.language] ?? "";
    const offenders: { slug: string; detail: string }[] = [];
    for (const s of j.stories) {
      if (!s.text) continue;
      const payload = {
        title: s.title ?? "",
        synopsis: s.synopsis ?? "",
        arcType: s.arcType ?? "reframe-turn",
        text: s.text,
        vocab: [],
      };
      const r = await validateGeneratedStory(JSON.stringify(payload), {
        language: iso,
        level: (s.level ?? "").toUpperCase(),
        variant: j.variant,
        topic: s.topic,
      });
      const c = r.checks.find((x) => x.id === "body-non-native-character");
      if (c?.status === "fail") offenders.push({ slug: s.slug ?? "(sin slug)", detail: c.detail ?? "" });
    }
    totalFail += offenders.length;
    const head = `${j.status.padEnd(6)} ${j.language}/${j.variant} ${j.levels.join(",")} ${j.name}`;
    console.log(`\n${head}  →  ${offenders.length}/${j.stories.length} FAIL`);
    for (const o of offenders) {
      const markers = o.detail.replace(/^Found \d+ non-native \/ language-learner marker\(s\): /, "").split(". Nobody")[0];
      console.log(`   ✗ ${o.slug}: ${markers}`);
    }
  }
  console.log(`\nTOTAL stories failing the native-speaker gate: ${totalFail}`);
  await prisma.$disconnect();
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
