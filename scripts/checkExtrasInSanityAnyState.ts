import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
import { createClient } from "@sanity/client";

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2025-10-05",
  useCdn: false,
  perspective: "raw",
});

const SLUGS = [
  // sourceType=sanity 6
  "auf-einen-kaffee-oder-was",
  "baustelle-vor-der-haustuer",
  "kleinanzeigen-deal-mit-ueberraschung",
  "spaeti-um-drei-die-letzte-mate",
  "u-bahn-chaos-am-montagmorgen",
];

async function main() {
  for (const slug of SLUGS) {
    const docs = await sanity.fetch<
      Array<{ _id: string; _type: string; published: boolean | null; sourceType: string | null }>
    >(
      `*[(_type == "standaloneStory" || _type == "story") && slug.current == $slug]{
         _id, _type, published, sourceType
       }`,
      { slug }
    );
    console.log(`\n${slug}`);
    if (docs.length === 0) console.log("  (no docs in Sanity)");
    for (const d of docs) console.log("  ", d);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
