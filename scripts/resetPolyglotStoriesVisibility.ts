import { createClient } from "@sanity/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_WRITE_TOKEN;

if (!projectId || !dataset || !token) {
  console.error("❌ Missing environment variables. Check .env or .env.local");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: "2024-10-01",
  useCdn: false,
});

type StoryDoc = {
  _id: string;
};

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const docs = await client.fetch<StoryDoc[]>(
    `*[
      _type == "story" &&
      contentSource == "polyglotCatalog"
    ]{
      _id
    }`
  );

  if (!Array.isArray(docs) || docs.length === 0) {
    console.log("🟡 No polyglot catalog stories found to reset.");
    return;
  }

  const batches = chunk(docs, 100);

  for (let i = 0; i < batches.length; i += 1) {
    let tx = client.transaction();
    for (const doc of batches[i]) {
      tx = tx.patch(doc._id, {
        set: { showInPolyglotStories: false },
      });
    }
    await tx.commit();
    console.log(`✅ Reset batch ${i + 1}/${batches.length} (${batches[i].length} docs)`);
  }

  console.log(`\n✅ Reset showInPolyglotStories=false for ${docs.length} catalog stories.\n`);
}

void main().catch((err: unknown) => {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
  console.error("❌ Reset failed:", message);
  process.exit(1);
});
