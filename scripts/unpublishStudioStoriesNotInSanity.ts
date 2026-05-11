// Marks StandaloneStory rows as `published = false` whenever their slug no
// longer exists in Sanity. This brings Studio in line with the current state
// of Sanity after the ETL snapshot grew stale (e.g. a story was deleted in
// Sanity in between the ETL run and the cutover).
//
// Idempotent. Safe to run repeatedly. Default is --dry-run; pass --write to
// actually update rows.

import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
import { createClient } from "@sanity/client";
import { PrismaClient } from "../src/generated/prisma";

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2025-10-05",
  useCdn: false,
  perspective: "raw",
});

async function main() {
  const write = process.argv.includes("--write");
  const prisma = new PrismaClient();
  try {
    const sanityDocs = await sanity.fetch<Array<{ slug: string | null }>>(
      `*[(_type == "standaloneStory" || _type == "story") && !(_id in path("drafts.**"))]{ "slug": slug.current }`
    );
    const sanitySlugs = new Set(
      sanityDocs.map((d) => d.slug).filter((s): s is string => Boolean(s))
    );

    const studioPublished = await prisma.standaloneStory.findMany({
      where: { published: true },
      select: { id: true, slug: true, sourceType: true, title: true, sanityId: true },
    });

    const stale = studioPublished.filter((s) => !sanitySlugs.has(s.slug));
    console.log(`Sanity unique slugs (any state, no drafts): ${sanitySlugs.size}`);
    console.log(`Studio published rows: ${studioPublished.length}`);
    console.log(`Stale (published in Studio, absent in Sanity): ${stale.length}`);
    console.log("");
    for (const s of stale) {
      console.log(`  ${s.slug}  [${s.sourceType ?? "?"}]  ${s.title}`);
    }
    console.log("");

    if (stale.length === 0) {
      console.log("Nothing to do. Studio already in parity with Sanity.");
      return;
    }
    if (!write) {
      console.log("Dry run. Pass --write to apply.");
      return;
    }

    const ids = stale.map((s) => s.id);
    const result = await prisma.standaloneStory.updateMany({
      where: { id: { in: ids } },
      data: { published: false },
    });
    console.log(`Updated ${result.count} rows to published=false.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
