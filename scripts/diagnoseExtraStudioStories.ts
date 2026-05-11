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

const PROBE_SLUGS = [
  "viaje-en-bus-a-medellin",
  "eine-reise-durch-berlin",
  "die-kultur-von-deutschland",
];

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const slug of PROBE_SLUGS) {
      console.log(`\n=== slug: ${slug} ===`);
      const studioRow = await prisma.standaloneStory.findUnique({
        where: { slug },
        select: { sanityId: true, published: true, title: true, language: true, sourceUpdatedAt: true },
      });
      console.log("  Studio:", studioRow);

      const sanityDocs = await sanity.fetch<
        Array<{ _id: string; _type: string; slug: string | null; published: boolean | null; title: string | null }>
      >(
        `*[_type == "standaloneStory" && slug.current == $slug] {
          _id, _type, "slug": slug.current, published, title
        }`,
        { slug }
      );
      console.log("  Sanity (standaloneStory):", sanityDocs.length);
      for (const d of sanityDocs) console.log("    ", d);

      const storyDocs = await sanity.fetch<
        Array<{ _id: string; _type: string; slug: string | null; published: boolean | null; title: string | null }>
      >(
        `*[_type == "story" && slug.current == $slug] {
          _id, _type, "slug": slug.current, published, title
        }`,
        { slug }
      );
      console.log("  Sanity (story):", storyDocs.length);
      for (const d of storyDocs) console.log("    ", d);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
