import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
import { createClient } from "@sanity/client";
import { PrismaClient } from "../src/generated/prisma";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const sanity = createClient({
  projectId: projectId!,
  dataset: dataset!,
  apiVersion: "2025-10-05",
  useCdn: false,
  perspective: "raw",
});

async function main() {
  const prisma = new PrismaClient();
  try {
    const sanityPublished = await sanity.fetch<Array<{ slug: string | null }>>(
      `*[_type == "standaloneStory" && !(_id in path("drafts.**")) && published == true]{ "slug": slug.current }`
    );
    const sanityAll = await sanity.fetch<Array<{ slug: string | null }>>(
      `*[_type == "standaloneStory" && !(_id in path("drafts.**"))]{ "slug": slug.current }`
    );
    const studioPublished = await prisma.standaloneStory.findMany({
      where: { published: true },
      select: { slug: true },
    });
    const studioAll = await prisma.standaloneStory.findMany({ select: { slug: true } });

    const sanityPubSlugs = new Set(
      sanityPublished.map((s) => s.slug).filter((s): s is string => Boolean(s))
    );
    const studioPubSlugs = new Set(studioPublished.map((s) => s.slug));

    console.log("Sanity published:", sanityPubSlugs.size, "  Sanity total:", sanityAll.length);
    console.log("Studio published:", studioPubSlugs.size, "  Studio total:", studioAll.length);

    const inSanityNotStudio: string[] = [];
    for (const s of sanityPubSlugs) if (!studioPubSlugs.has(s)) inSanityNotStudio.push(s);
    const inStudioNotSanity: string[] = [];
    for (const s of studioPubSlugs) if (!sanityPubSlugs.has(s)) inStudioNotSanity.push(s);

    console.log("");
    console.log("Published only in Sanity (would break if flag is on):", inSanityNotStudio.length);
    for (const s of inSanityNotStudio) console.log("  -", s);
    console.log("Published only in Studio (extra):", inStudioNotSanity.length);

    // Break extras down by sourceType.
    if (inStudioNotSanity.length > 0) {
      const rows = await prisma.standaloneStory.findMany({
        where: { slug: { in: inStudioNotSanity } },
        select: { slug: true, sourceType: true, sanityId: true, title: true },
      });
      const bySrc = new Map<string, typeof rows>();
      for (const r of rows) {
        const k = r.sourceType ?? "(null)";
        const arr = bySrc.get(k) ?? [];
        arr.push(r);
        bySrc.set(k, arr);
      }
      for (const [src, list] of bySrc) {
        console.log(`  sourceType=${src}: ${list.length}`);
        for (const r of list.slice(0, 5)) console.log(`    - ${r.slug}  (sanityId=${r.sanityId})`);
        if (list.length > 5) console.log(`    ... and ${list.length - 5} more`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
