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

async function main() {
  const all = await sanity.fetch<
    Array<{ _id: string; slug: string | null; published: boolean | null }>
  >(`*[_type == "standaloneStory"]{ _id, "slug": slug.current, published }`);
  console.log("Total docs (incl drafts):", all.length);
  const drafts = all.filter((d) => d._id.startsWith("drafts."));
  const nondraft = all.filter((d) => !d._id.startsWith("drafts."));
  const pub = nondraft.filter((d) => d.published === true);
  const nopub = nondraft.filter((d) => d.published !== true);
  console.log("Drafts:", drafts.length);
  console.log("Non-drafts total:", nondraft.length);
  console.log("Non-drafts published:", pub.length);
  console.log("Non-drafts unpublished:", nopub.length);

  const slugCounts = new Map<string, number>();
  for (const d of nondraft) {
    const s = d.slug ?? "(null)";
    slugCounts.set(s, (slugCounts.get(s) ?? 0) + 1);
  }
  const dups = Array.from(slugCounts.entries()).filter(([, n]) => n > 1);
  console.log("Slugs with >1 non-draft doc:", dups.length);
  for (const [s, n] of dups.slice(0, 10)) console.log("  -", s, "→", n);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
