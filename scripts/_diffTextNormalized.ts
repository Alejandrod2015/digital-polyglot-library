import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { books } from "../src/data/books";

const p = new PrismaClient();

// Same normalization the reader applies in StoryContent.sanitizePlainStoryText:
// strip tags, collapse whitespace, and remove the space that stripping a
// </span> leaves in front of punctuation.
function readerText(s: string) {
  return (s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?…)])/g, "$1")
    .replace(/([¿¡(])\s+/g, "$1")
    .trim();
}

async function main() {
  let identical = 0,
    different = 0;
  const diffs: string[] = [];

  for (const b of Object.values(books)) {
    const row = await p.catalogBook.findUnique({ where: { slug: b.slug }, include: { stories: true } });
    if (!row) continue;
    const byslug = new Map(row.stories.map((s) => [s.slug, s]));
    for (const s of b.stories) {
      const r = byslug.get(s.slug);
      if (!r) continue;
      const a = readerText(s.text);
      const c = readerText(r.text);
      if (a === c) {
        identical += 1;
        continue;
      }
      different += 1;
      // show the first divergence in context
      let i = 0;
      while (i < a.length && i < c.length && a[i] === c[i]) i += 1;
      diffs.push(
        `  ${b.slug}/${s.slug}\n    DUMP: ...${a.slice(Math.max(0, i - 60), i + 60)}...\n    DB  : ...${c.slice(Math.max(0, i - 60), i + 60)}...`
      );
    }
  }

  console.log(`historias con texto IDENTICO tras normalizar: ${identical}`);
  console.log(`historias con texto REALMENTE distinto:       ${different}`);
  if (diffs.length) console.log("\n" + diffs.slice(0, 10).join("\n"));

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
