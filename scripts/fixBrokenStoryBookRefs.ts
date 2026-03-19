import { createClient } from "@sanity/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_WRITE_TOKEN;

if (!projectId || !dataset || !token) {
  console.error("Missing Sanity environment variables. Check .env or .env.local");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-10-05",
  useCdn: false,
  perspective: "raw",
});

type StoryDoc = {
  _id: string;
  _type: "story";
  title?: string | null;
  book?: {
    _ref?: string | null;
  } | null;
};

type BookDoc = {
  _id: string;
};

async function main() {
  const [, , maybeDocId] = process.argv;

  const docs = maybeDocId
    ? await client.fetch<StoryDoc[]>(
        `*[_id == $id && _type == "story"]{ _id, _type, title, book }`,
        { id: maybeDocId }
      )
    : await client.fetch<StoryDoc[]>(
        `*[
          _type == "story" &&
          defined(book._ref) &&
          (_id match "drafts.*" || _id match "story.*")
        ]{
          _id,
          _type,
          title,
          book
        }`
      );

  if (!Array.isArray(docs) || docs.length === 0) {
    console.log("[fix-broken-story-book-refs] No matching story documents found.");
    return;
  }

  let fixed = 0;

  for (const doc of docs) {
    const bookRef = doc.book?._ref?.trim();
    if (!bookRef) continue;

    const book = await client.fetch<BookDoc | null>(
      `*[_id == $id && _type == "book"][0]{ _id }`,
      { id: bookRef }
    );

    if (book?._id) continue;

    await client.patch(doc._id).unset(["book"]).commit();
    fixed += 1;
    console.log(
      `[fix-broken-story-book-refs] Unset broken book ref on ${doc._id} (${doc.title ?? "Untitled"})`
    );
  }

  console.log(`[fix-broken-story-book-refs] Fixed ${fixed} document(s).`);
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  console.error("[fix-broken-story-book-refs] Failed:", message);
  process.exit(1);
});
