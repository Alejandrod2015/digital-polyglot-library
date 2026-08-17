import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { books } from "../src/data/books";

const p = new PrismaClient();

async function main() {
  let TD = 0,
    TB = 0;
  for (const b of Object.values(books)) {
    const row = await p.catalogBook.findUnique({ where: { slug: b.slug }, include: { stories: true } });
    if (!row) continue;
    const byslug = new Map(row.stories.map((s) => [s.slug, s]));
    let d = 0,
      db = 0;
    for (const s of b.stories) {
      d += (s.vocab ?? []).length;
      const r = byslug.get(s.slug);
      db += Array.isArray(r?.vocab) ? (r!.vocab as unknown[]).length : 0;
    }
    TD += d;
    TB += db;
    console.log(`${b.slug.padEnd(52)} dumpVocab=${String(d).padStart(4)}  dbVocab=${String(db).padStart(4)}  delta=${db - d}`);
  }
  console.log(`TOTAL (4 libros) dump=${TD} db=${TB} delta=${TB - TD}`);

  // sample side-by-side
  const slug = "el-mercado-de-medellin";
  const dumpStory = Object.values(books)
    .flatMap((b) => b.stories)
    .find((s) => s.slug === slug);
  const dbStory = await p.catalogStory.findFirst({ where: { slug } });
  console.log(`\n--- ${slug} DUMP vocab (${(dumpStory?.vocab ?? []).length}) ---`);
  console.log((dumpStory?.vocab ?? []).map((v: { word: string; definition: string }) => `  ${v.word}: ${v.definition}`).join("\n"));
  console.log(`\n--- ${slug} DB vocab (${Array.isArray(dbStory?.vocab) ? (dbStory!.vocab as unknown[]).length : 0}) ---`);
  console.log(
    (Array.isArray(dbStory?.vocab) ? (dbStory!.vocab as { word: string; definition: string }[]) : [])
      .map((v) => `  ${v.word}: ${v.definition}`)
      .join("\n")
  );
  console.log("\nDB row provenance:", {
    migratedFrom: dbStory?.migratedFrom,
    sanityId: dbStory?.sanityId,
    sourceUpdatedAt: dbStory?.sourceUpdatedAt,
    updatedAt: dbStory?.updatedAt,
  });

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
