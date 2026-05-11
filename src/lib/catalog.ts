// Reads from the Studio catalog tables (CatalogBook / CatalogStory) and
// returns shapes that are 1:1 compatible with the existing Book / Story
// types consumed by web pages, emails, mobile API, etc.
//
// Callers should gate access behind shouldReadBookFromStudio() and keep their
// existing Sanity / static-dump fallback for slugs that are not yet flagged.

import { prisma } from "@/lib/prisma";
import type {
  Book,
  CefrLevel,
  Level,
  Story,
  VocabItem,
} from "@domain/types/books";
import type {
  CatalogBook as CatalogBookRow,
  CatalogStory as CatalogStoryRow,
} from "@/generated/prisma";

function asLevel(v: string | null): Level {
  if (v === "beginner" || v === "intermediate" || v === "advanced") return v;
  return "beginner";
}

function asOptionalLevel(v: string | null): Level | undefined {
  if (v === "beginner" || v === "intermediate" || v === "advanced") return v;
  return undefined;
}

function asCefr(v: string | null): CefrLevel | undefined {
  if (v === "a1" || v === "a2" || v === "b1" || v === "b2" || v === "c1" || v === "c2") return v;
  return undefined;
}

function asFormality(v: string | null): Book["formality"] | undefined {
  if (v === "informal" || v === "neutral" || v === "formal") return v;
  return undefined;
}

function asVocab(v: CatalogStoryRow["vocab"]): VocabItem[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v as unknown as VocabItem[];
}

function rowToStory(row: CatalogStoryRow): Story {
  return {
    id: row.slug,
    slug: row.slug,
    title: row.title,
    text: row.text,
    audio: row.audio,
    createdAt: row.sourceCreatedAt?.toISOString(),
    updatedAt: row.sourceUpdatedAt?.toISOString(),
    cover: row.cover ?? undefined,
    coverUrl: row.coverUrl ?? undefined,
    vocab: asVocab(row.vocab),
    tags: row.tags.length > 0 ? row.tags : undefined,
    topic: row.topic ?? undefined,
    language: row.language ?? undefined,
    variant: row.variant ?? undefined,
    region: row.region ?? undefined,
    level: asOptionalLevel(row.level),
    cefrLevel: asCefr(row.cefrLevel),
    formality: asFormality(row.formality),
    overrideMetadata: row.overrideMetadata || undefined,
  };
}

function rowToBook(row: CatalogBookRow, stories: CatalogStoryRow[]): Book {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    subtitle: row.subtitle ?? undefined,
    createdAt: row.sourceCreatedAt?.toISOString(),
    updatedAt: row.sourceUpdatedAt?.toISOString(),
    cover: row.cover,
    theme: row.theme.length > 0 ? row.theme : undefined,
    audioFolder: row.audioFolder,
    storeUrl: row.storeUrl ?? undefined,
    published: row.published,
    language: row.language,
    variant: row.variant ?? undefined,
    region: row.region ?? undefined,
    level: asLevel(row.level),
    cefrLevel: asCefr(row.cefrLevel),
    topic: row.topic ?? undefined,
    formality: asFormality(row.formality),
    stories: stories.map(rowToStory),
  };
}

export async function getCatalogBook(slug: string): Promise<Book | null> {
  const row = await prisma.catalogBook.findUnique({
    where: { slug },
    include: { stories: { orderBy: { position: "asc" } } },
  });
  if (!row) return null;
  return rowToBook(row, row.stories);
}

export async function getCatalogStory(
  bookSlug: string,
  storySlug: string
): Promise<{ book: Book; story: Story } | null> {
  const bookRow = await prisma.catalogBook.findUnique({
    where: { slug: bookSlug },
    include: { stories: { orderBy: { position: "asc" } } },
  });
  if (!bookRow) return null;
  const storyRow = bookRow.stories.find((s) => s.slug === storySlug);
  if (!storyRow) return null;
  const book = rowToBook(bookRow, bookRow.stories);
  const story = rowToStory(storyRow);
  return { book, story };
}

export async function getCatalogBookMeta(
  slug: string
): Promise<{ title: string; cover: string; description: string } | null> {
  const row = await prisma.catalogBook.findUnique({
    where: { slug },
    select: { title: true, cover: true, description: true },
  });
  if (!row) return null;
  return {
    title: row.title,
    cover: row.cover,
    description: row.description,
  };
}
