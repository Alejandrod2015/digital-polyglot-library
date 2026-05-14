// Studio Next.js editor backend for CatalogBook + CatalogStory.
// Reads and writes Prisma directly. Sandboxed from the journey pipeline:
// never touches JourneyStory or StoryDraft.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import type { CatalogBook, CatalogStory } from "@/generated/prisma";

export type StudioCatalogBook = {
  id: string;
  slug: string;
  title: string;
  description: string;
  subtitle: string | null;
  cover: string;
  coverUrl: string | null;
  theme: string[];
  language: string;
  variant: string | null;
  region: string | null;
  level: string;
  cefrLevel: string | null;
  topic: string | null;
  formality: string | null;
  audioFolder: string;
  storeUrl: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  storyCount?: number;
};

export type StudioCatalogStory = {
  id: string;
  bookId: string;
  slug: string;
  position: number;
  title: string;
  text: string;
  audio: string;
  audioUrl: string | null;
  cover: string | null;
  coverUrl: string | null;
  topic: string | null;
  tags: string[];
  vocab: unknown;
  language: string | null;
  variant: string | null;
  region: string | null;
  level: string | null;
  cefrLevel: string | null;
  formality: string | null;
  overrideMetadata: boolean;
  createdAt: string;
  updatedAt: string;
};

function bookToDto(row: CatalogBook, storyCount?: number): StudioCatalogBook {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    subtitle: row.subtitle,
    cover: row.cover,
    coverUrl: row.coverUrl,
    theme: row.theme,
    language: row.language,
    variant: row.variant,
    region: row.region,
    level: row.level,
    cefrLevel: row.cefrLevel,
    topic: row.topic,
    formality: row.formality,
    audioFolder: row.audioFolder,
    storeUrl: row.storeUrl,
    published: row.published,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(typeof storyCount === "number" ? { storyCount } : {}),
  };
}

function storyToDto(row: CatalogStory): StudioCatalogStory {
  return {
    id: row.id,
    bookId: row.bookId,
    slug: row.slug,
    position: row.position,
    title: row.title,
    text: row.text,
    audio: row.audio,
    audioUrl: row.audioUrl,
    cover: row.cover,
    coverUrl: row.coverUrl,
    topic: row.topic,
    tags: row.tags,
    vocab: row.vocab,
    language: row.language,
    variant: row.variant,
    region: row.region,
    level: row.level,
    cefrLevel: row.cefrLevel,
    formality: row.formality,
    overrideMetadata: row.overrideMetadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const BOOK_PATCH_KEYS = [
  "slug",
  "title",
  "description",
  "subtitle",
  "cover",
  "coverUrl",
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
] as const;

type BookPatch = Partial<Pick<StudioCatalogBook, (typeof BOOK_PATCH_KEYS)[number]>>;

function sanitizeBookPatch(input: Record<string, unknown>): BookPatch {
  const out: Record<string, unknown> = {};
  for (const k of BOOK_PATCH_KEYS) if (k in input) out[k] = input[k];
  return out as BookPatch;
}

const STORY_PATCH_KEYS = [
  "slug",
  "position",
  "title",
  "text",
  "audio",
  "audioUrl",
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
] as const;

type StoryPatch = Partial<Pick<StudioCatalogStory, (typeof STORY_PATCH_KEYS)[number]>>;

function sanitizeStoryPatch(input: Record<string, unknown>): StoryPatch {
  const out: Record<string, unknown> = {};
  for (const k of STORY_PATCH_KEYS) if (k in input) out[k] = input[k];
  return out as StoryPatch;
}

// ─── Books ──────────────────────────────────────────────────────

export async function listStudioCatalogBooks(filters?: {
  language?: string;
  level?: string;
  published?: boolean;
  query?: string;
}): Promise<StudioCatalogBook[]> {
  const where: Prisma.CatalogBookWhereInput = {};
  if (filters?.language) where.language = filters.language;
  if (filters?.level) where.level = filters.level;
  if (typeof filters?.published === "boolean") where.published = filters.published;
  if (filters?.query?.trim()) {
    const q = filters.query.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { topic: { contains: q, mode: "insensitive" } },
    ];
  }
  const rows = await prisma.catalogBook.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    include: { _count: { select: { stories: true } } },
  });
  return rows.map((row) =>
    bookToDto(row, (row as CatalogBook & { _count?: { stories?: number } })._count?.stories)
  );
}

export async function getStudioCatalogBook(id: string): Promise<StudioCatalogBook | null> {
  const row = await prisma.catalogBook.findUnique({
    where: { id },
    include: { _count: { select: { stories: true } } },
  });
  if (!row) return null;
  return bookToDto(row, (row as CatalogBook & { _count?: { stories?: number } })._count?.stories);
}

export async function createStudioCatalogBook(
  input: Record<string, unknown>
): Promise<StudioCatalogBook> {
  const patch = sanitizeBookPatch(input);
  if (!patch.slug?.trim()) throw new Error("slug is required");
  if (!patch.title?.trim()) throw new Error("title is required");
  if (!patch.language?.trim()) throw new Error("language is required");
  if (!patch.level?.trim()) throw new Error("level is required");

  const existing = await prisma.catalogBook.findUnique({ where: { slug: patch.slug } });
  if (existing) {
    throw new Error(`A catalog book with slug "${patch.slug}" already exists.`);
  }

  const row = await prisma.catalogBook.create({
    data: {
      id: patch.slug,
      slug: patch.slug,
      title: patch.title,
      description: patch.description ?? "",
      subtitle: patch.subtitle ?? null,
      cover: patch.cover ?? "/covers/default.jpg",
      coverUrl: patch.coverUrl ?? null,
      theme: patch.theme ?? [],
      language: patch.language,
      variant: patch.variant ?? null,
      region: patch.region ?? null,
      level: patch.level,
      cefrLevel: patch.cefrLevel ?? null,
      topic: patch.topic ?? null,
      formality: patch.formality ?? null,
      audioFolder: patch.audioFolder ?? "",
      storeUrl: patch.storeUrl ?? null,
      published: patch.published ?? true,
      migratedFrom: "studio-manual",
    },
  });
  return bookToDto(row);
}

export async function patchStudioCatalogBook(
  id: string,
  input: Record<string, unknown>
): Promise<StudioCatalogBook | null> {
  const patch = sanitizeBookPatch(input);
  if (patch.slug) {
    const existing = await prisma.catalogBook.findUnique({ where: { slug: patch.slug } });
    if (existing && existing.id !== id) {
      throw new Error(`A catalog book with slug "${patch.slug}" already exists.`);
    }
  }
  try {
    const row = await prisma.catalogBook.update({ where: { id }, data: patch });
    return bookToDto(row);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return null;
    throw err;
  }
}

export async function deleteStudioCatalogBook(id: string): Promise<boolean> {
  try {
    await prisma.catalogBook.delete({ where: { id } });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return false;
    throw err;
  }
}

// ─── Stories within a book ──────────────────────────────────────

export async function listStudioCatalogStories(bookId: string): Promise<StudioCatalogStory[]> {
  const rows = await prisma.catalogStory.findMany({
    where: { bookId },
    orderBy: [{ position: "asc" }],
  });
  return rows.map(storyToDto);
}

export async function getStudioCatalogStory(
  bookId: string,
  storyId: string
): Promise<StudioCatalogStory | null> {
  const row = await prisma.catalogStory.findUnique({ where: { id: storyId } });
  if (!row || row.bookId !== bookId) return null;
  return storyToDto(row);
}

function compositeStoryId(bookId: string, slug: string): string {
  return `${bookId}:${slug}`;
}

export async function createStudioCatalogStory(
  bookId: string,
  input: Record<string, unknown>
): Promise<StudioCatalogStory> {
  const patch = sanitizeStoryPatch(input);
  if (!patch.slug?.trim()) throw new Error("slug is required");
  if (!patch.title?.trim()) throw new Error("title is required");

  const book = await prisma.catalogBook.findUnique({ where: { id: bookId } });
  if (!book) throw new Error(`Catalog book "${bookId}" not found`);

  const id = compositeStoryId(bookId, patch.slug);
  const dup = await prisma.catalogStory.findUnique({ where: { id } });
  if (dup) throw new Error(`A story with slug "${patch.slug}" already exists in this book.`);

  const maxPosition = await prisma.catalogStory.findFirst({
    where: { bookId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const nextPosition = (maxPosition?.position ?? -1) + 1;

  const row = await prisma.catalogStory.create({
    data: {
      id,
      bookId,
      slug: patch.slug,
      position: patch.position ?? nextPosition,
      title: patch.title,
      text: patch.text ?? "",
      audio: patch.audio ?? "",
      audioUrl: patch.audioUrl ?? null,
      cover: patch.cover ?? null,
      coverUrl: patch.coverUrl ?? null,
      topic: patch.topic ?? null,
      tags: patch.tags ?? [],
      vocab: (patch.vocab as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      language: patch.language ?? null,
      variant: patch.variant ?? null,
      region: patch.region ?? null,
      level: patch.level ?? null,
      cefrLevel: patch.cefrLevel ?? null,
      formality: patch.formality ?? null,
      overrideMetadata: patch.overrideMetadata ?? false,
      migratedFrom: "studio-manual",
    },
  });
  return storyToDto(row);
}

export async function patchStudioCatalogStory(
  bookId: string,
  storyId: string,
  input: Record<string, unknown>
): Promise<StudioCatalogStory | null> {
  const existing = await prisma.catalogStory.findUnique({ where: { id: storyId } });
  if (!existing || existing.bookId !== bookId) return null;

  const patch = sanitizeStoryPatch(input);

  // Slug rename → derive a new composite id so the (bookId, slug) unique
  // index stays consistent. Use a transaction so listing endpoints don't
  // momentarily see a duplicate.
  if (patch.slug && patch.slug !== existing.slug) {
    const newId = compositeStoryId(bookId, patch.slug);
    const dup = await prisma.catalogStory.findUnique({ where: { id: newId } });
    if (dup) throw new Error(`A story with slug "${patch.slug}" already exists in this book.`);
    return prisma.$transaction(async (tx) => {
      await tx.catalogStory.delete({ where: { id: storyId } });
      const row = await tx.catalogStory.create({
        data: {
          ...existing,
          ...patch,
          id: newId,
          createdAt: existing.createdAt,
          vocab:
            patch.vocab !== undefined
              ? (patch.vocab as Prisma.InputJsonValue)
              : (existing.vocab as Prisma.InputJsonValue | null) ?? Prisma.JsonNull,
        },
      });
      return storyToDto(row);
    });
  }

  try {
    const data: Prisma.CatalogStoryUpdateInput = { ...patch } as Prisma.CatalogStoryUpdateInput;
    if (patch.vocab !== undefined) {
      data.vocab = patch.vocab as Prisma.InputJsonValue;
    }
    const row = await prisma.catalogStory.update({ where: { id: storyId }, data });
    return storyToDto(row);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return null;
    throw err;
  }
}

export async function deleteStudioCatalogStory(bookId: string, storyId: string): Promise<boolean> {
  const existing = await prisma.catalogStory.findUnique({ where: { id: storyId } });
  if (!existing || existing.bookId !== bookId) return false;
  await prisma.catalogStory.delete({ where: { id: storyId } });
  return true;
}
