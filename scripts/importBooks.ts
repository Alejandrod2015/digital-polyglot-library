import { createClient } from "@sanity/client";
import { ssDeDe } from "../src/data/books/ss-de-de";
import dotenv from "dotenv";

// Load environment variables manually from both .env and .env.local
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

// Debug check to confirm env variables are loaded
console.log("🔍 ENV CHECK");
console.log("projectId:", process.env.NEXT_PUBLIC_SANITY_PROJECT_ID);
console.log("dataset:", process.env.NEXT_PUBLIC_SANITY_DATASET);
console.log("token:", process.env.SANITY_API_TOKEN ? "✅ Loaded" : "❌ Missing");

if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || !process.env.NEXT_PUBLIC_SANITY_DATASET) {
  console.error("❌ Missing environment variables. Check .env or .env.local");
  process.exit(1);
}

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  token: process.env.SANITY_API_TOKEN,
  apiVersion: "2024-10-01",
  useCdn: false,
});

async function importBook() {
  const book = ssDeDe;

  console.log(`\n🚀 Importing book: ${book.title}`);

  // 1. Create book document
  const bookDoc = await client.createIfNotExists({
    _id: `book.${book.id}`,
    _type: "book",
    title: book.title,
    description: book.description,
    audioFolder: book.audioFolder,
    published: true,
  });

  console.log(`✅ Book created: ${book.title}`);

  // 2. Create stories for that book
  for (const story of book.stories) {
    await client.createIfNotExists({
      _id: `story.${book.id}.${story.id}`,
      _type: "story",
      title: story.title,
      text: story.text,
      dialogue: "",
      book: { _type: "reference", _ref: bookDoc._id },
      published: true,
    });

    console.log(`   ↳ Story added: ${story.title}`);
  }

  console.log("\n✅ Import completed successfully.\n");
}

importBook().catch((err) => {
  console.error("❌ Import failed:", err.message);
  process.exit(1);
});
