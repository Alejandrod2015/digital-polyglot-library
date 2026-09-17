// Scratch: entradas de glosa con `gm` cuyo tipo RESUELTO no es sustantivo.
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { normalizeVocabType } from "../packages/domain/src/vocabTypes";
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.tapGlossSet.findMany({
    select: { id: true, bundle: true, slug: true, glosses: true },
  });
  let withGm = 0;
  const bad: { bundle: string; slug: string; word: string; gm: string; t: string; type: string; g: string }[] = [];
  for (const row of rows) {
    const map = row.glosses as Record<string, { g: string; t?: string; gm?: string }>;
    for (const [word, entry] of Object.entries(map ?? {})) {
      if (!entry || typeof entry !== "object" || !entry.gm) continue;
      withGm++;
      const type = normalizeVocabType(entry.t, { word, definition: entry.g }) ?? "other";
      if (type !== "noun") {
        bad.push({ bundle: row.bundle, slug: row.slug, word, gm: entry.gm, t: entry.t ?? "(sin t)", type, g: entry.g });
      }
    }
  }
  console.log(`entradas con gm: ${withGm}`);
  console.log(`no-noun: ${bad.length}`);
  for (const b of bad.sort((a, z) => a.bundle.localeCompare(z.bundle) || a.word.localeCompare(z.word))) {
    console.log(`${b.bundle} | slug=${b.slug || "(global)"} | ${b.word} | gm=${b.gm} | t=${b.t} -> ${b.type} | ${b.g}`);
  }
  await prisma.$disconnect();
}
main();
