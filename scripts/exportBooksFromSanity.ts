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
  if (/^\d/.test(s)) s = "b" + s;
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

  // 🚀 Ahora traemos también metadatos lingüísticos del libro
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
      language,
      region,
      topic,
      formality,
      // 🖼️ URL de portada
      "cover": select(
        defined(cover.asset->url) => cover.asset->url,
        "/covers/default.jpg"
      ),
      // 🪶 historias asociadas
      "stories": *[_type == "story" && references(^._id) && published == true] | order(_createdAt asc) {
        _id,
        title,
        text,
        "slug": coalesce(slug.current, _id),
        "audio": coalesce(audio.asset->url, ""),
        vocabRaw
      }
    }`
  );

  if (!rawBooks?.length) {
    console.log("⚠️ No published books found in Sanity.");
    return;
  }

  const outDir = path.join(process.cwd(), "src/data/books");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const generated: { fileName: string; constName: string }[] = [];

  for (const b of rawBooks as any[]) {
    const bookId: string = b.id || b._id || "unknown";
    const bookSlug: string = b.slug || bookId;
    const constName = toConstName(bookId);
    const fileName = `${bookId}.ts`;

    const stories =
      (b.stories ?? []).map((s: any, i: number) => ({
        id: String(s.slug || s._id || i + 1),
        slug: String(s.slug || s._id || `story-${i + 1}`),
        title: s.title ?? `Story ${i + 1}`,
        text: s.text ?? "",
        audio: s.audio ?? "",
        vocab: normalizeVocab(s.vocabRaw),
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
  language: ${JSON.stringify(b.language ?? "english")},
  region: ${JSON.stringify(b.region ?? "usa")},
  topic: ${JSON.stringify(b.topic ?? "")},
  formality: ${JSON.stringify(b.formality ?? "neutral")},
  audioFolder: ${JSON.stringify(b.audioFolder ?? "")},
  stories: ${JSON.stringify(stories, null, 2)}
};
`;

    fs.writeFileSync(path.join(outDir, fileName), content);
    generated.push({ fileName, constName });
    console.log(`✅ Exported → ${path.join("src/data/books", fileName)}`);
  }

  // 🔁 Rebuild index.ts
  const indexPath = path.join(outDir, "index.ts");
  const importLines = generated
    .map((g) => `import { ${g.constName} } from "./${g.fileName.replace(/\.ts$/, "")}";`)
    .join("\n");

  const entries = generated
    .map((g) => `  [${g.constName}.id]: ${g.constName},`)
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
