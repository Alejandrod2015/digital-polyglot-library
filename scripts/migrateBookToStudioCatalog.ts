// scripts/migrateBookToStudioCatalog.ts
//
// Migrates ONE book (and all its stories) from the local Sanity dump
// (src/data/books/<slug>.ts) into the Studio catalog tables in Prisma
// (CatalogBook / CatalogStory).
//
// Designed to be safe to run repeatedly: every write is an idempotent upsert
// keyed on the slug. A `--dry-run` mode reports what *would* change without
// touching the DB.
//
// Usage:
//   tsx scripts/migrateBookToStudioCatalog.ts --book <book-slug> [--dry-run]
//
// Example:
//   tsx scripts/migrateBookToStudioCatalog.ts \
//     --book colombian-spanish-stories-for-beginners --dry-run

import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
import { books } from "../src/data/books";
import type { Book, Story } from "../packages/domain/src/types/books";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

type Args = {
  bookSlug: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  let bookSlug = "";
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--book") {
      bookSlug = argv[++i] ?? "";
    } else if (a.startsWith("--book=")) {
      bookSlug = a.slice("--book=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }
  if (!bookSlug) {
    console.error(
      "❌ Missing --book <slug>. Available books:\n" +
        Object.keys(books)
          .map((k) => `   - ${k}`)
          .join("\n")
    );
    process.exit(1);
  }
  return { bookSlug, dryRun };
}

function pickBook(slugOrId: string): Book {
  const byId = books[slugOrId];
  if (byId) return byId;
  const found = Object.values(books).find(
    (b) => b.slug === slugOrId || b.id === slugOrId
  );
  if (!found) {
    console.error(
      `❌ Book "${slugOrId}" not found in src/data/books. Known ids:\n` +
        Object.keys(books)
          .map((k) => `   - ${k}`)
          .join("\n")
    );
    process.exit(1);
  }
  return found;
}

function toIso(maybe: string | undefined): Date | null {
  if (!maybe) return null;
  const d = new Date(maybe);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asThemeArray(theme: Book["theme"]): string[] {
  if (Array.isArray(theme)) return theme;
  if (typeof theme === "string" && theme.length > 0) return [theme];
  return [];
}

function storyCompositeId(bookId: string, storySlug: string): string {
  return `${bookId}:${storySlug}`;
}

function bookPayload(book: Book) {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    description: book.description ?? "",
    subtitle: book.subtitle ?? null,
    cover: book.cover ?? "/covers/default.jpg",
    theme: asThemeArray(book.theme),
    language: book.language,
    variant: book.variant ?? null,
    region: book.region ?? null,
    level: book.level,
    cefrLevel: book.cefrLevel ?? null,
    topic: book.topic ?? null,
    formality: book.formality ?? null,
    audioFolder: book.audioFolder ?? "",
    storeUrl: book.storeUrl ?? null,
    published: book.published ?? true,
    sourceCreatedAt: toIso(book.createdAt),
    sourceUpdatedAt: toIso(book.updatedAt),
    migratedFrom: "sanity-local-dump",
    sanityId: null as string | null,
  };
}

function storyPayload(book: Book, story: Story, position: number) {
  return {
    id: storyCompositeId(book.id, story.slug),
    bookId: book.id,
    slug: story.slug,
    position,
    title: story.title,
    text: story.text ?? "",
    audio: story.audio ?? "",
    cover: story.cover ?? null,
    coverUrl: story.coverUrl ?? null,
    topic: story.topic ?? null,
    tags: Array.isArray(story.tags) ? story.tags : [],
    vocab: Array.isArray(story.vocab) ? story.vocab : null,
    language: story.language ?? null,
    variant: story.variant ?? null,
    region: story.region ?? null,
    level: story.level ?? null,
    cefrLevel: story.cefrLevel ?? null,
    formality: story.formality ?? null,
    overrideMetadata: story.overrideMetadata ?? false,
    sourceCreatedAt: toIso(story.createdAt),
    sourceUpdatedAt: toIso(story.updatedAt),
    migratedFrom: "sanity-local-dump",
    sanityId: null as string | null,
  };
}

function diffFields<T extends Record<string, unknown>>(
  existing: T | null,
  next: T,
  keys: (keyof T)[]
): string[] {
  if (!existing) return ["<new row>"];
  const changes: string[] = [];
  for (const k of keys) {
    const a = existing[k];
    const b = next[k];
    const aJson = JSON.stringify(a);
    const bJson = JSON.stringify(b);
    if (aJson !== bJson) {
      const short = (s: string) => (s && s.length > 60 ? s.slice(0, 57) + "..." : s);
      changes.push(`${String(k)}: ${short(aJson ?? "null")} → ${short(bJson ?? "null")}`);
    }
  }
  return changes;
}

async function main() {
  const { bookSlug, dryRun } = parseArgs(process.argv.slice(2));
  const book = pickBook(bookSlug);

  const prisma = new PrismaClient();

  try {
    console.log(`📚 Book: ${book.title}`);
    console.log(`   slug=${book.slug}  language=${book.language}  level=${book.level}  region=${book.region ?? "-"}`);
    console.log(`   stories in dump: ${book.stories.length}`);
    console.log(`   mode: ${dryRun ? "DRY RUN (no writes)" : "WRITE"}`);
    console.log("");

    const nextBook = bookPayload(book);
    const existingBook = await prisma.catalogBook.findUnique({ where: { id: book.id } });

    const bookKeys: (keyof typeof nextBook)[] = [
      "slug",
      "title",
      "description",
      "subtitle",
      "cover",
      "theme",
      "language",
      "variant",
      "region",
      "level",
      "cefrLevel",
      "topic",
      "formality",
      "audioFolder",
      "storeUrl",
      "published",
    ];
    const bookChanges = diffFields(existingBook as never, nextBook as never, bookKeys as never);
    if (bookChanges.length === 0) {
      console.log(`📘 CatalogBook[${book.id}]: unchanged`);
    } else {
      console.log(`📘 CatalogBook[${book.id}]: ${existingBook ? "UPDATE" : "CREATE"}`);
      for (const c of bookChanges) console.log(`     • ${c}`);
    }
    console.log("");

    const storySummary = { create: 0, update: 0, unchanged: 0 };
    const storyKeys: (keyof ReturnType<typeof storyPayload>)[] = [
      "slug",
      "position",
      "title",
      "text",
      "audio",
      "cover",
      "coverUrl",
      "topic",
      "tags",
      "vocab",
      "language",
      "variant",
      "region",
      "level",
      "cefrLevel",
      "formality",
      "overrideMetadata",
    ];

    const storyOps: Array<{
      id: string;
      slug: string;
      kind: "create" | "update" | "unchanged";
      changes: string[];
      payload: ReturnType<typeof storyPayload>;
    }> = [];

    for (let i = 0; i < book.stories.length; i++) {
      const story = book.stories[i];
      const next = storyPayload(book, story, i);
      const existing = await prisma.catalogStory.findUnique({ where: { id: next.id } });
      const changes = diffFields(existing as never, next as never, storyKeys as never);
      let kind: "create" | "update" | "unchanged";
      if (!existing) kind = "create";
      else if (changes.length === 0) kind = "unchanged";
      else kind = "update";
      storySummary[kind]++;
      storyOps.push({ id: next.id, slug: story.slug, kind, changes, payload: next });
    }

    console.log(`📖 Stories: ${storySummary.create} create, ${storySummary.update} update, ${storySummary.unchanged} unchanged`);
    for (const op of storyOps) {
      if (op.kind === "unchanged") continue;
      console.log(`   [${op.kind.toUpperCase()}] ${op.slug}`);
      for (const c of op.changes.slice(0, 6)) console.log(`        • ${c}`);
      if (op.changes.length > 6) console.log(`        • ...and ${op.changes.length - 6} more`);
    }
    console.log("");

    if (dryRun) {
      console.log("🟡 Dry run complete. No writes performed.");
      return;
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.catalogBook.upsert({
          where: { id: book.id },
          create: nextBook,
          update: nextBook,
        });
        for (const op of storyOps) {
          await tx.catalogStory.upsert({
            where: { id: op.id },
            create: op.payload,
            update: op.payload,
          });
        }
      },
      { maxWait: 10_000, timeout: 120_000 }
    );

    console.log(`✅ Migrated "${book.title}" → CatalogBook + ${book.stories.length} CatalogStory rows.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error("❌ migrate-book-to-studio-catalog failed:", msg);
  process.exit(1);
});
