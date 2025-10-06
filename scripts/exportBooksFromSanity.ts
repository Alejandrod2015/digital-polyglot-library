// scripts/exportBooksFromSanity.ts
import { createClient } from "@sanity/client";
import { groq } from "next-sanity";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-10-01",
  useCdn: false,
});

// Helpers
const toConstName = (raw: string) => {
  let s = (raw || "book").replace(/[^a-zA-Z0-9]/g, "");
  if (!s) s = "book";
  if (/^\d/.test(s)) s = "b" + s; // que no empiece por número
  return s;
};

const normalizeVocab = (v: unknown): any[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

async function exportBooks() {
  console.log("📚 Fetching books from Sanity...");

  // Traemos books + stories. Para stories pedimos también slug y vocabRaw.
  const rawBooks = await client.fetch(
  groq`*[_type == "book" && published == true]{
    _id,
    title,
    description,
    "id": coalesce(id.current, slug.current, _id),
    "slug": coalesce(slug.current, id.current, _id),
    audioFolder,
    theme,
    level,
    // 🖼️ URL de portada si existe
    "cover": coalesce(cover.asset->url, "/covers/default.jpg"),
    // stories
    "stories": *[
      _type == "story" && references(^._id) && published == true
    ] | order(_createdAt asc) {
      _id,
      title,
      text,
      "slug": coalesce(slug.current, _id),
      "audio": audio.asset->originalFilename,
      vocabRaw,
      isFree
    }
  }`
);




  if (!rawBooks?.length) {
    console.log("⚠️ No published books found in Sanity.");
    return;
  }

  // Normalizamos shape a tus tipos locales
  type RawStory = {
    _id?: string;
    slug?: string;
    title?: string;
    text?: string;
    audio?: string;
    vocabRaw?: unknown;
    isFree?: boolean;
  };

  const outDir = path.join(process.cwd(), "src/data/books");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const generated: { fileName: string; constName: string }[] = [];

  for (const b of rawBooks as any[]) {
    const bookId: string = b.id || b._id || "unknown";
    const bookSlug: string = b.slug || bookId;
    const constName = toConstName(bookId);         // nombre del export
    const fileName = `${bookId}.ts`;               // nombre del archivo

    const stories = (b.stories as RawStory[] | undefined)?.map((s, i) => ({
      id: String(s.slug || s._id || i + 1),        // <- SIEMPRE "id" (no _id)
      slug: String(s.slug || s._id || `story-${i + 1}`),
      title: s.title ?? `Story ${i + 1}`,
      text: s.text ?? "",
      audio: s.audio ?? "",
      vocab: normalizeVocab(s.vocabRaw),
      isFree: !!s.isFree,
    })) ?? [];

    const content = `import { Book } from "@/types/books";

export const ${constName}: Book = {
  id: ${JSON.stringify(bookId)},
  slug: ${JSON.stringify(bookSlug)},
  title: ${JSON.stringify(b.title ?? "")},
  description: ${JSON.stringify(b.description ?? "")},
  cover: ${JSON.stringify(b.cover ?? "/covers/default.jpg")},
  theme: ${JSON.stringify(b.theme ?? [])},
  level: ${JSON.stringify(b.level ?? "beginner")},
  audioFolder: ${JSON.stringify(b.audioFolder ?? "")},
  stories: ${JSON.stringify(stories, null, 2)}
};
`;

    fs.writeFileSync(path.join(outDir, fileName), content);
    generated.push({ fileName, constName });
    console.log(`✅ Exported → ${path.join("src/data/books", fileName)}`);
  }

  // Regeneramos src/data/books/index.ts para evitar errores manuales
  const indexPath = path.join(outDir, "index.ts");
  const importLines = generated
    .map(g => `import { ${g.constName} } from "./${g.fileName.replace(/\.ts$/, "")}";`)
    .join("\n");

  const entries = generated
    .map(g => `  [${g.constName}.id]: ${g.constName},`)
    .join("\n");

  const indexContent = `import type { Book } from "@/types/books";
${importLines}

export const books: Record<string, Book> = {
${entries}
};
`;

  fs.writeFileSync(indexPath, indexContent);
  console.log(`🧩 Rebuilt → src/data/books/index.ts`);

  console.log("\n✨ Export completed successfully!");
}

exportBooks().catch((err) => {
  console.error("❌ Export failed:", err?.stack || err?.message || String(err));
  process.exit(1);
});
