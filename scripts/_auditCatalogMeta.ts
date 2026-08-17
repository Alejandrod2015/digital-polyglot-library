import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

async function main() {
  const books = await p.catalogBook.findMany({
    orderBy: [{ published: "desc" }, { slug: "asc" }],
    include: { stories: { orderBy: { position: "asc" } } },
  });

  console.log("=== BOOK-LEVEL METADATA ===");
  for (const b of books) {
    const missing: string[] = [];
    if (!b.cefrLevel) missing.push("cefrLevel");
    if (!b.variant) missing.push("variant");
    if (!b.region) missing.push("region");
    if (!b.topic) missing.push("topic");
    if (!b.formality) missing.push("formality");
    if (!b.storeUrl) missing.push("storeUrl");
    if (!b.subtitle) missing.push("subtitle");
    if (!b.description) missing.push("description");
    if (!b.coverUrl) missing.push("coverUrl");
    if (!b.theme.length) missing.push("theme");
    console.log(
      `${b.published ? "PUB  " : "UNPUB"} ${b.slug.padEnd(52)} missing: ${missing.join(", ") || "-"}`
    );
  }

  console.log("\n=== STORY-LEVEL METADATA NULLS (per book) ===");
  for (const b of books) {
    const n = (f: (s: (typeof b.stories)[number]) => unknown) => b.stories.filter((s) => !f(s)).length;
    console.log(
      `${b.published ? "PUB  " : "UNPUB"} ${b.slug.padEnd(52)} ` +
        `lang=${n((s) => s.language)} variant=${n((s) => s.variant)} region=${n((s) => s.region)} ` +
        `level=${n((s) => s.level)} cefr=${n((s) => s.cefrLevel)} topic=${n((s) => s.topic)} ` +
        `tags=${b.stories.filter((s) => s.tags.length === 0).length} synopsis=${n((s) => s.synopsis)} ` +
        `cover=${n((s) => s.coverUrl ?? s.cover)}`
    );
  }

  console.log("\n=== SLUG COLLISIONS ACROSS BOOKS ===");
  const bySlug = new Map<string, string[]>();
  for (const b of books) for (const s of b.stories) bySlug.set(s.slug, [...(bySlug.get(s.slug) ?? []), b.slug]);
  for (const [slug, bks] of bySlug) if (bks.length > 1) console.log(`  ${slug} -> ${bks.join(", ")}`);

  console.log("\n=== TITLE DUPES ACROSS BOOKS ===");
  const byTitle = new Map<string, string[]>();
  for (const b of books) for (const s of b.stories) byTitle.set(s.title.toLowerCase(), [...(byTitle.get(s.title.toLowerCase()) ?? []), `${b.slug}/${s.slug}`]);
  for (const [t, arr] of byTitle) if (arr.length > 1) console.log(`  "${t}" -> ${arr.join(", ")}`);

  console.log("\n=== SYNOPSIS == FIRST PARAGRAPH OF TEXT ===");
  let dup = 0;
  for (const b of books) {
    for (const s of b.stories) {
      if (!s.synopsis) continue;
      const firstP = (s.text ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
      const syn = s.synopsis.replace(/\s+/g, " ").trim().slice(0, 120);
      if (firstP && syn && firstP === syn) {
        dup += 1;
        console.log(`  ${b.slug}/${s.slug}`);
      }
    }
  }
  console.log(`  total: ${dup}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
