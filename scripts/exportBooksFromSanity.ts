// scripts/exportBooksFromSanity.ts
import { createClient } from "@sanity/client";
import { groq } from "next-sanity";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

if (!projectId || !dataset) {
  console.error("❌ Missing NEXT_PUBLIC_SANITY_PROJECT_ID or NEXT_PUBLIC_SANITY_DATASET");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: "2024-10-01",
  useCdn: false,
});

type RawStory = {
  _id?: string;
  title?: string;
  text?: string;
  slug?: string;
  audio?: string;
  cover?: string;
  vocabRaw?: unknown;
  _updatedAt?: string;
};

type RawBook = {
  _id?: string;
  _updatedAt?: string;
  title?: string;
  description?: string;
  id?: string;
  slug?: string;
  audioFolder?: string;
  theme?: unknown;
  level?: string;
  language?: string;
  region?: string;
  topic?: string;
  formality?: string;
  storeUrl?: string;
  cover?: string;
  stories?: RawStory[];
};

type ExportedStory = {
  id: string;
  slug: string;
  title: string;
  text: string;
  audio: string;
  cover?: string;
  vocab: unknown[];
};

type ExportedBook = {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover: string;
  theme: unknown;
  level: string;
  language: string;
  region?: string;
  topic: string;
  formality: string;
  audioFolder: string;
  storeUrl: string;
  stories: ExportedStory[];
};

type ExportState = {
  lastRunAt: string;
};

type ExportMeta = {
  ranAt: string;
  since: string | null;
  changedBookIds: string[];
};

const OUT_DIR = path.join(process.cwd(), "src/data/books");
const INDEX_PATH = path.join(OUT_DIR, "index.ts");
const STATE_PATH = path.join(OUT_DIR, ".export-state.json");
const META_PATH = path.join(OUT_DIR, ".export-meta.json");

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return parsed as T;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeVocab(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed: unknown = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toConstName(raw: string): string {
  let s = (raw || "book").replace(/[^a-zA-Z0-9]/g, "");
  if (!s) s = "book";
  if (/^\d/.test(s)) s = "b" + s;
  return s;
}

function safeString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeIfChanged(filePath: string, content: string): boolean {
  const next = content.endsWith("\n") ? content : content + "\n";
  if (fs.existsSync(filePath)) {
    const prev = fs.readFileSync(filePath, "utf8");
    if (sha256(prev) === sha256(next)) return false;
  }
  fs.writeFileSync(filePath, next, "utf8");
  return true;
}

function listBookFiles(): string[] {
  if (!fs.existsSync(OUT_DIR)) return [];
  return fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts" && !f.startsWith("."))
    .sort((a, b) => a.localeCompare(b));
}

function buildIndexFromFiles(): void {
  const files = listBookFiles();

  const imports: string[] = [];
  const entries: string[] = [];

  for (const fileName of files) {
    const id = fileName.replace(/\.ts$/, "");
    const constName = toConstName(id);
    imports.push(`import { ${constName} } from "./${id}";`);
    entries.push(`  [${constName}.id]: ${constName},`);
  }

  const indexContent = `import type { Book } from "@/types/books";
${imports.join("\n")}

export const books: Record<string, Book> = {
${entries.join("\n")}
};
`;

  writeIfChanged(INDEX_PATH, indexContent);
}

function getSinceIso(): string | null {
  const state = readJsonFile<ExportState>(STATE_PATH);
  if (!state || !isRecord(state) || typeof state.lastRunAt !== "string") return null;
  return state.lastRunAt;
}

async function exportBooks() {
  console.log("📚 Fetching books from Sanity...");

  ensureDir(OUT_DIR);

  const since = getSinceIso();
  const query = groq`*[_type == "book" && published == true && (
      $since == null ||
      _updatedAt > $since ||
      count(*[_type == "story" && references(^._id) && published == true && _updatedAt > $since]) > 0
    )]{
      _id,
      _updatedAt,
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
      storeUrl,
      "cover": select(
        defined(cover.asset->url) => cover.asset->url,
        "/covers/default.jpg"
      ),
      "stories": *[_type == "story" && references(^._id) && published == true] | order(_createdAt asc) {
        _id,
        _updatedAt,
        title,
        text,
        "slug": coalesce(slug.current, _id),
        "audio": coalesce(audio.asset->url, ""),
        "cover": select(
          defined(cover.asset->url) => cover.asset->url,
          null
        ),
        vocabRaw
      }
    }`;

  const rawBooks = await client.fetch<unknown>(query, { since });

  const list: RawBook[] = Array.isArray(rawBooks) ? (rawBooks as RawBook[]) : [];
  if (list.length === 0) {
    console.log("⚠️ No changed published books found in Sanity.");
    const ranAt = new Date().toISOString();
    writeJsonFile(STATE_PATH, { lastRunAt: ranAt } satisfies ExportState);
    writeJsonFile(META_PATH, { ranAt, since, changedBookIds: [] } satisfies ExportMeta);
    return;
  }

  const changedBookIds: string[] = [];
  for (const b of list) {
    const bookId = safeString(b.id, safeString(b._id, "unknown"));
    const bookSlug = safeString(b.slug, bookId);
    const constName = toConstName(bookId);
    const fileName = `${bookId}.ts`;

    const storiesRaw: RawStory[] = Array.isArray(b.stories) ? b.stories : [];
    const stories: ExportedStory[] = storiesRaw.map((s, i) => {
      const sSlug = safeString(s.slug, safeString(s._id, `story-${i + 1}`));
      const sCover =
        typeof s.cover === "string" && s.cover.length > 0 ? s.cover : undefined;

      return {
        id: sSlug,
        slug: sSlug,
        title: safeString(s.title, `Story ${i + 1}`),
        text: safeString(s.text, ""),
        audio: safeString(s.audio, ""),
        ...(sCover ? { cover: sCover } : {}),
        vocab: normalizeVocab(s.vocabRaw),
      };
    });

    const exported: ExportedBook = {
      id: bookId,
      slug: bookSlug,
      title: safeString(b.title, ""),
      description: safeString(b.description, ""),
      cover: safeString(b.cover, "/covers/default.jpg"),
      theme: b.theme ?? [],
      level: safeString(b.level, "beginner"),
      language: safeString(b.language, "english"),
      region: typeof b.region === "string" && b.region.length > 0 ? b.region : undefined,
      topic: safeString(b.topic, ""),
      formality: safeString(b.formality, "neutral"),
      audioFolder: safeString(b.audioFolder, ""),
      storeUrl: safeString(b.storeUrl, ""),
      stories,
    };

    const content = `import { Book } from "@/types/books";

export const ${constName}: Book = ${JSON.stringify(exported, null, 2)};
`;

    const wrote = writeIfChanged(path.join(OUT_DIR, fileName), content);
    if (wrote) {
      console.log(`✅ Exported → ${path.join("src/data/books", fileName)}`);
    } else {
      console.log(`↩️  Unchanged → ${path.join("src/data/books", fileName)}`);
    }

    changedBookIds.push(bookId);
  }

  buildIndexFromFiles();

  const ranAt = new Date().toISOString();
  writeJsonFile(STATE_PATH, { lastRunAt: ranAt } satisfies ExportState);
  writeJsonFile(META_PATH, { ranAt, since, changedBookIds } satisfies ExportMeta);

  console.log(`🧩 Rebuilt → src/data/books/index.ts`);
  console.log(`✨ Export completed successfully! (changed: ${changedBookIds.length})`);
}

exportBooks().catch((err: unknown) => {
  const message =
    err instanceof Error ? err.stack ?? err.message : typeof err === "string" ? err : "Unknown error";
  console.error("❌ Export failed:", message);
  process.exit(1);
});