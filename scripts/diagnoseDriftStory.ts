import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
import { createClient } from "@sanity/client";
import { PrismaClient } from "../src/generated/prisma";

const SLUG = process.argv[2] ?? "paseo-por-san-telmo";

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2025-10-05",
  useCdn: false,
  perspective: "raw",
});

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log(`Slug: ${SLUG}`);
    console.log("");

    const studioRow = await prisma.standaloneStory.findUnique({ where: { slug: SLUG } });
    console.log("Studio row (raw fields relevant to media):");
    console.log("  cover:    ", studioRow?.cover);
    console.log("  coverUrl: ", studioRow?.coverUrl);
    console.log("  audio:    ", studioRow?.audio);
    console.log("  audioUrl: ", studioRow?.audioUrl);
    console.log("");

    const sanityDoc = await sanity.fetch<{ coverAsset: string | null; coverUrl: string | null; audioAsset: string | null; audioUrl: string | null } | null>(
      `*[_type == "standaloneStory" && slug.current == $slug && !(_id in path("drafts.**"))][0]{
        "coverAsset": cover.asset->url,
        coverUrl,
        "audioAsset": audio.asset->url,
        audioUrl
      }`,
      { slug: SLUG }
    );
    console.log("Sanity doc:");
    console.log("  coverAsset:", sanityDoc?.coverAsset ?? "(null)");
    console.log("  coverUrl:  ", sanityDoc?.coverUrl ?? "(null)");
    console.log("  audioAsset:", sanityDoc?.audioAsset ?? "(null)");
    console.log("  audioUrl:  ", sanityDoc?.audioUrl ?? "(null)");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
