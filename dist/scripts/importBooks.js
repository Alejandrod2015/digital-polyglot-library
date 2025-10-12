"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@sanity/client");
const dotenv = require("dotenv"); // ✅ FIX: importar como namespace, no default
const ss_de_de_1 = require("../src/data/books/ss-de-de");
// Carga manual de variables de entorno
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
console.log("🔍 ENV CHECK");
console.log("projectId:", process.env.NEXT_PUBLIC_SANITY_PROJECT_ID);
console.log("dataset:", process.env.NEXT_PUBLIC_SANITY_DATASET);
console.log("token:", process.env.SANITY_API_TOKEN ? "✅ Loaded" : "❌ Missing");
if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || !process.env.NEXT_PUBLIC_SANITY_DATASET) {
    console.error("❌ Missing environment variables. Check .env or .env.local");
    process.exit(1);
}
const client = (0, client_1.createClient)({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    token: process.env.SANITY_API_TOKEN,
    apiVersion: "2024-10-01",
    useCdn: false,
});
async function importBook() {
    const book = ss_de_de_1.ssDeDe;
    console.log(`\n🚀 Importing book: ${book.title}`);
    // 🧩 1. Crear el documento del libro
    const bookDoc = await client.createIfNotExists({
        _id: `book.${book.id}`,
        _type: "book",
        title: book.title,
        description: book.description,
        audioFolder: book.audioFolder,
        language: book.language,
        region: book.region,
        level: book.level,
        topic: book.topic,
        formality: book.formality,
        published: true,
    });
    console.log(`✅ Book created: ${book.title}`);
    // 🧠 2. Crear las historias asociadas
    for (const story of book.stories) {
        await client.createIfNotExists({
            _id: `story.${book.id}.${story.id}`,
            _type: "story",
            title: story.title,
            text: story.text,
            dialogue: "",
            language: story.language || book.language,
            region: story.region || book.region,
            level: story.level || book.level,
            topic: story.topic || book.topic,
            formality: story.formality || book.formality,
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
