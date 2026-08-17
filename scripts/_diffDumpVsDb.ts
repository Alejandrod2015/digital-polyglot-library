import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { books } from "../src/data/books";

const p = new PrismaClient();

function norm(s: string) {
  return (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
  for (const b of Object.values(books)) {
    const row = await p.catalogBook.findUnique({
      where: { slug: b.slug },
      include: { stories: true },
    });
    if (!row) {
      console.log(`\n### ${b.slug}: NOT IN DB`);
      continue;
    }
    const byslug = new Map(row.stories.map((s) => [s.slug, s]));
    let textDiff = 0,
      vocabDiff = 0,
      audioDiff = 0,
      missing = 0;
    const details: string[] = [];
    for (const s of b.stories) {
      const r = byslug.get(s.slug);
      if (!r) {
        missing += 1;
        details.push(`    MISSING IN DB: ${s.slug}`);
        continue;
      }
      const dumpText = norm(s.text);
      const dbText = norm(r.text);
      if (dumpText !== dbText) {
        textDiff += 1;
        if (details.length < 12)
          details.push(
            `    TEXT ${s.slug}: dump=${dumpText.split(" ").length}w db=${dbText.split(" ").length}w`
          );
      }
      const dv = (s.vocab ?? []).length;
      const rv = Array.isArray(r.vocab) ? (r.vocab as unknown[]).length : 0;
      if (dv !== rv) {
        vocabDiff += 1;
        details.push(`    VOCAB ${s.slug}: dump=${dv} db=${rv}`);
      }
      const da = s.audio ?? "";
      const ra = r.audioUrl ?? r.audio ?? "";
      if (da !== ra) audioDiff += 1;
    }
    console.log(
      `\n### ${b.slug}: dumpStories=${b.stories.length} dbStories=${row.stories.length} | textDiff=${textDiff} vocabDiff=${vocabDiff} audioUrlDiff=${audioDiff} missingInDb=${missing}`
    );
    if (details.length) console.log(details.slice(0, 12).join("\n"));
  }
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
