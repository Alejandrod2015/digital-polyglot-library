// Studio Next.js editor backend for the StandaloneStory model (Prisma).
//
// Replaces the Sanity Studio editor that used to live at
// /studio/sanity for `standaloneStory`. Treats Prisma as the source of
// truth: list / get / create / patch / delete operate directly against
// the StandaloneStory table.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

export type StudioStandaloneStory = {
  id: string;
  slug: string;
  sourceType: string;
  language: string | null;
  variant: string | null;
  region: string | null;
  level: string | null;
  cefrLevel: string | null;
  focus: string | null;
  topic: string | null;
  journeyEligible: boolean;
  journeyTopic: string | null;
  journeyOrder: number | null;
  journeyFocus: string | null;
  title: string;
  synopsis: string | null;
  text: string;
  vocabRaw: string | null;
  cover: string | null;
  coverUrl: string | null;
  audio: string | null;
  audioUrl: string | null;
  audioQaStatus: string | null;
  audioQaScore: number | null;
  audioQaNotes: string | null;
  audioQaTranscript: string | null;
  audioQaCheckedAt: string | null;
  audioDeliveryQaStatus: string | null;
  audioDeliveryQaScore: number | null;
  audioDeliveryQaNotes: string | null;
  audioDeliveryQaCheckedAt: string | null;
  storyVocabQualityRaw: string | null;
  vocabValidationRaw: string | null;
  published: boolean;
  sanityId: string | null;
  migratedFrom: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = Awaited<ReturnType<typeof prisma.standaloneStory.findFirst>>;

function rowToDto(row: NonNullable<Row>): StudioStandaloneStory {
  return {
    id: row.id,
    slug: row.slug,
    sourceType: row.sourceType,
    language: row.language,
    variant: row.variant,
    region: row.region,
    level: row.level,
    cefrLevel: row.cefrLevel,
    focus: row.focus,
    topic: row.topic,
    journeyEligible: row.journeyEligible,
    journeyTopic: row.journeyTopic,
    journeyOrder: row.journeyOrder,
    journeyFocus: row.journeyFocus,
    title: row.title,
    synopsis: row.synopsis,
    text: row.text,
    vocabRaw: row.vocabRaw,
    cover: row.cover,
    coverUrl: row.coverUrl,
    audio: row.audio,
    audioUrl: row.audioUrl,
    audioQaStatus: row.audioQaStatus,
    audioQaScore: row.audioQaScore,
    audioQaNotes: row.audioQaNotes,
    audioQaTranscript: row.audioQaTranscript,
    audioQaCheckedAt: row.audioQaCheckedAt?.toISOString() ?? null,
    audioDeliveryQaStatus: row.audioDeliveryQaStatus,
    audioDeliveryQaScore: row.audioDeliveryQaScore,
    audioDeliveryQaNotes: row.audioDeliveryQaNotes,
    audioDeliveryQaCheckedAt: row.audioDeliveryQaCheckedAt?.toISOString() ?? null,
    storyVocabQualityRaw: row.storyVocabQualityRaw,
    vocabValidationRaw: row.vocabValidationRaw,
    published: row.published,
    sanityId: row.sanityId,
    migratedFrom: row.migratedFrom,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type ListFilters = {
  language?: string;
  level?: string;
  cefrLevel?: string;
  published?: boolean;
  sourceType?: string;
  query?: string;
};

export async function listStudioStandaloneStories(
  filters: ListFilters = {}
): Promise<StudioStandaloneStory[]> {
  const where: Prisma.StandaloneStoryWhereInput = {};
  if (filters.language) where.language = filters.language;
  if (filters.level) where.level = filters.level;
  if (filters.cefrLevel) where.cefrLevel = filters.cefrLevel;
  if (typeof filters.published === "boolean") where.published = filters.published;
  if (filters.sourceType) where.sourceType = filters.sourceType;
  if (filters.query?.trim()) {
    const q = filters.query.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { topic: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.standaloneStory.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
  });
  return rows.map(rowToDto);
}

export async function getStudioStandaloneStory(
  id: string
): Promise<StudioStandaloneStory | null> {
  const row = await prisma.standaloneStory.findUnique({ where: { id } });
  return row ? rowToDto(row) : null;
}

const ALLOWED_PATCH_KEYS = [
  "title",
  "slug",
  "sourceType",
  "language",
  "variant",
  "region",
  "level",
  "cefrLevel",
  "focus",
  "topic",
  "journeyEligible",
  "journeyTopic",
  "journeyOrder",
  "journeyFocus",
  "synopsis",
  "text",
  "vocabRaw",
  "cover",
  "coverUrl",
  "audio",
  "audioUrl",
  "published",
] as const;

type PatchInput = Partial<{
  title: string;
  slug: string;
  sourceType: string;
  language: string | null;
  variant: string | null;
  region: string | null;
  level: string | null;
  cefrLevel: string | null;
  focus: string | null;
  topic: string | null;
  journeyEligible: boolean;
  journeyTopic: string | null;
  journeyOrder: number | null;
  journeyFocus: string | null;
  synopsis: string | null;
  text: string;
  vocabRaw: string | null;
  cover: string | null;
  coverUrl: string | null;
  audio: string | null;
  audioUrl: string | null;
  published: boolean;
}>;

function sanitizePatch(input: Record<string, unknown>): PatchInput {
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_PATCH_KEYS) {
    if (key in input) out[key] = input[key];
  }
  return out as PatchInput;
}

export type CreateInput = PatchInput & { title: string; slug: string };

export async function createStudioStandaloneStory(
  input: Record<string, unknown>
): Promise<StudioStandaloneStory> {
  const patch = sanitizePatch(input);
  if (!patch.title || !patch.slug) {
    throw new Error("title and slug are required");
  }
  const existing = await prisma.standaloneStory.findUnique({ where: { slug: patch.slug } });
  if (existing) {
    throw new Error(`A standalone story with slug "${patch.slug}" already exists.`);
  }
  const row = await prisma.standaloneStory.create({
    data: {
      id: patch.slug,
      slug: patch.slug,
      title: patch.title,
      sourceType: patch.sourceType ?? "studio",
      migratedFrom: null,
      text: patch.text ?? "",
      synopsis: patch.synopsis ?? null,
      language: patch.language ?? null,
      variant: patch.variant ?? null,
      region: patch.region ?? null,
      level: patch.level ?? null,
      cefrLevel: patch.cefrLevel ?? null,
      focus: patch.focus ?? null,
      topic: patch.topic ?? null,
      journeyEligible: patch.journeyEligible ?? false,
      journeyTopic: patch.journeyTopic ?? null,
      journeyOrder: patch.journeyOrder ?? null,
      journeyFocus: patch.journeyFocus ?? null,
      vocabRaw: patch.vocabRaw ?? null,
      cover: patch.cover ?? null,
      coverUrl: patch.coverUrl ?? null,
      audio: patch.audio ?? null,
      audioUrl: patch.audioUrl ?? null,
      published: patch.published ?? false,
    },
  });
  return rowToDto(row);
}

export async function patchStudioStandaloneStory(
  id: string,
  input: Record<string, unknown>
): Promise<StudioStandaloneStory | null> {
  const patch = sanitizePatch(input);
  // If the caller updates the slug, also update the natural id (the slug
  // doubles as the primary key for stable upserts); only allowed when no
  // other row already uses the new slug.
  if (patch.slug) {
    const existing = await prisma.standaloneStory.findUnique({ where: { slug: patch.slug } });
    if (existing && existing.id !== id) {
      throw new Error(`A standalone story with slug "${patch.slug}" already exists.`);
    }
  }
  try {
    const row = await prisma.standaloneStory.update({
      where: { id },
      data: patch,
    });
    return rowToDto(row);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return null;
    throw err;
  }
}

export async function deleteStudioStandaloneStory(id: string): Promise<boolean> {
  try {
    await prisma.standaloneStory.delete({ where: { id } });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return false;
    throw err;
  }
}
