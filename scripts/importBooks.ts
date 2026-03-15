// scripts/importBooks.ts
import { createClient } from "@sanity/client";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { books } from "../src/data/books";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

type ExportMeta = {
  ranAt: string;
  since: string | null;
  changedBookIds: string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readExportMeta(): ExportMeta | null {
  try {
    const p = path.join(process.cwd(), "src/data/books/.export-meta.json");
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const ranAt = typeof parsed.ranAt === "string" ? parsed.ranAt : "";
    const since = typeof parsed.since === "string" ? parsed.since : null;

    const changedBookIdsRaw = parsed.changedBookIds;
    const changedBookIds =
      Array.isArray(changedBookIdsRaw) && changedBookIdsRaw.every((x) => typeof x === "string")
        ? changedBookIdsRaw
        : [];

    if (!ranAt) return null;
    return { ranAt, since, changedBookIds };
  } catch {
    return null;
  }
}

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_WRITE_TOKEN;

console.log("🔍 ENV CHECK");
console.log("projectId:", projectId);
console.log("dataset:", dataset);
console.log("token:", token ? "✅ Loaded" : "❌ Missing");

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

type SanityCreateIfNotExists = {
  createIfNotExists: {
    _id: string;
    _type: string;
    [key: string]: unknown;
  };
};

type SanityPatch = {
  patch: {
    id: string;
    set: Record<string, unknown>;
  };
};

type SanityMutation = SanityCreateIfNotExists | SanityPatch;

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function getBookIdsToImport(meta: ExportMeta | null): string[] {
  const allIds = Object.keys(books);
  if (meta && meta.changedBookIds.length > 0) return meta.changedBookIds;
  return allIds;
}

function slugValue(value: string | undefined) {
  const current = typeof value === "string" ? value.trim() : "";
  return current ? { _type: "slug", current } : undefined;
}

function getStoryRegionField(language: string | undefined): string | null {
  switch ((language ?? "").toLowerCase()) {
    case "spanish":
      return "region_es";
    case "english":
      return "region_en";
    case "german":
      return "region_de";
    case "french":
      return "region_fr";
    case "italian":
      return "region_it";
    case "portuguese":
      return "region_pt";
    default:
      return null;
  }
}

function imageAssetRefFromUrl(url: string | undefined): string | null {
  if (typeof url !== "string") return null;
  const match = url.match(/\/images\/[^/]+\/[^/]+\/([a-f0-9]+)-(\d+x\d+)\.([a-z0-9]+)$/i);
  if (!match) return null;
  const [, assetId, dimensions, ext] = match;
  return `image-${assetId}-${dimensions}-${ext}`;
}

function fileAssetRefFromUrl(url: string | undefined): string | null {
  if (typeof url !== "string") return null;
  const match = url.match(/\/files\/[^/]+\/[^/]+\/([a-f0-9]+)\.([a-z0-9]+)$/i);
  if (!match) return null;
  const [, assetId, ext] = match;
  return `file-${assetId}-${ext}`;
}

function imageFieldFromUrl(url: string | undefined) {
  const ref = imageAssetRefFromUrl(url);
  return ref
    ? {
        _type: "image",
        asset: { _type: "reference", _ref: ref },
      }
    : undefined;
}

function fileFieldFromUrl(url: string | undefined) {
  const ref = fileAssetRefFromUrl(url);
  return ref
    ? {
        _type: "file",
        asset: { _type: "reference", _ref: ref },
      }
    : undefined;
}

async function commitMutations(mutations: SanityMutation[], batchSize: number) {
  const batches = chunk(mutations, batchSize);
  for (let i = 0; i < batches.length; i++) {
    const tx = client.transaction();
    for (const m of batches[i]) {
      if ("createIfNotExists" in m) {
        tx.createIfNotExists(m.createIfNotExists);
      } else {
        tx.patch(m.patch.id, { set: m.patch.set });
      }
    }
    await tx.commit();
    console.log(`✅ Committed batch ${i + 1}/${batches.length} (${batches[i].length} docs)`);
  }
}

async function importBooks() {
  const meta = readExportMeta();

  if (meta && meta.changedBookIds.length === 0) {
    console.log(`🟡 No changed books to import (since: ${meta.since ?? "first run"}).`);
    console.log("\n✅ Import skipped.\n");
    return;
  }

  const allIds = Object.keys(books);
  const idsToImport =
    meta && meta.changedBookIds.length > 0 ? meta.changedBookIds : allIds;

  if (meta) {
    console.log(
      `📦 Import scope: ${idsToImport.length} book(s) (changed since: ${meta.since ?? "first run"})`
    );
  } else {
    console.log(`📦 Import scope: ${idsToImport.length} book(s) (no export meta found)`);
  }

  const mutations: SanityMutation[] = [];

  let totalStories = 0;

  for (const bookId of idsToImport) {
    const book = books[bookId];
    if (!book) continue;

    const bookDocId = `book.${book.id}`;

    // 1) Book doc
    mutations.push({
      createIfNotExists: {
        _id: bookDocId,
        _type: "book",
      },
    });

    mutations.push({
      patch: {
        id: bookDocId,
        set: {
        title: book.title,
        slug: slugValue(book.slug),
        id: slugValue(book.id),
        description: book.description,
        audioFolder: book.audioFolder,
        language: book.language,
        variant: book.variant,
        region: book.region,
        level: book.level,
        cefrLevel: book.cefrLevel,
        topic: book.topic,
        formality: book.formality,
        storeUrl: book.storeUrl,
        cover: imageFieldFromUrl(book.cover),
        published: true,
        },
      }
    });

    // 2) Story docs
    for (const story of book.stories) {
      const storyId =
        typeof story.id === "string" && story.id.length > 0 ? story.id : story.slug;

      mutations.push({
        createIfNotExists: {
          _id: `story.${book.id}.${storyId}`,
          _type: "story",
          showInPolyglotStories: false,
        },
      });

      const storyLanguage =
        typeof (story as unknown as { language?: unknown }).language === "string"
          ? (story as unknown as { language?: string }).language
          : book.language;
      const storyRegion =
        typeof (story as unknown as { region?: unknown }).region === "string"
          ? (story as unknown as { region?: string }).region
          : book.region;
      const storyRegionField = getStoryRegionField(storyLanguage);

      mutations.push({
        patch: {
          id: `story.${book.id}.${storyId}`,
          set: {
            title: story.title,
            slug: slugValue(story.slug),
            synopsis:
              typeof (story as unknown as { synopsis?: unknown }).synopsis === "string"
                ? (story as unknown as { synopsis?: string }).synopsis
                : "",
            text: story.text,
            language: storyLanguage,
            variant:
              typeof (story as unknown as { variant?: unknown }).variant === "string"
                ? (story as unknown as { variant?: string }).variant
                : book.variant,
            level:
              typeof (story as unknown as { level?: unknown }).level === "string"
                ? (story as unknown as { level?: string }).level
                : book.level,
            cefrLevel:
              typeof (story as unknown as { cefrLevel?: unknown }).cefrLevel === "string"
                ? (story as unknown as { cefrLevel?: string }).cefrLevel
                : book.cefrLevel,
            topic:
              typeof (story as unknown as { topic?: unknown }).topic === "string"
                ? (story as unknown as { topic?: string }).topic
                : book.topic,
            formality:
              typeof (story as unknown as { formality?: unknown }).formality === "string"
                ? (story as unknown as { formality?: string }).formality
                : book.formality,
            ...(storyRegionField && typeof storyRegion === "string"
              ? { [storyRegionField]: storyRegion }
              : {}),
            vocabRaw: Array.isArray(story.vocab) ? JSON.stringify(story.vocab, null, 2) : "",
            cover: imageFieldFromUrl(story.cover),
            audio: fileFieldFromUrl(story.audio),
            book: { _type: "reference", _ref: bookDocId },
            contentSource: "polyglotCatalog",
            published: true,
          },
        },
      });

      totalStories += 1;
    }
  }

  console.log(`🧾 Mutations prepared: ${mutations.length} docs (${idsToImport.length} books, ${totalStories} stories)`);

  // Ajusta si quieres: 50–200 suele ir bien.
  // Demasiado grande puede fallar por payload/tiempo.
  const BATCH_SIZE = 80;

  await commitMutations(mutations, BATCH_SIZE);

  console.log("\n✅ Import completed successfully.\n");
}

importBooks().catch((err: unknown) => {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
  console.error("❌ Import failed:", message);
  process.exit(1);
});
