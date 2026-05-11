// scripts/migrateStandaloneStoriesToStudio.ts
//
// Migrates standaloneStory documents live from Sanity into the Studio
// catalog (StandaloneStory in Prisma). Idempotent upsert keyed on slug.
//
// Usage:
//   tsx scripts/migrateStandaloneStoriesToStudio.ts [--all|--slug <s>|--limit N] [--dry-run]
//
// Examples:
//   # Dry run, first 5 docs (sanity check):
//   tsx scripts/migrateStandaloneStoriesToStudio.ts --limit 5 --dry-run
//
//   # Process a single story:
//   tsx scripts/migrateStandaloneStoriesToStudio.ts --slug my-story-slug
//
//   # Full migration:
//   tsx scripts/migrateStandaloneStoriesToStudio.ts --all

import dotenv from "dotenv";
import { createClient } from "@sanity/client";
import { PrismaClient } from "../src/generated/prisma";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

type Args = {
  slug: string | null;
  all: boolean;
  limit: number | null;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  let slug: string | null = null;
  let all = false;
  let limit: number | null = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slug") slug = argv[++i] ?? null;
    else if (a.startsWith("--slug=")) slug = a.slice("--slug=".length);
    else if (a === "--all") all = true;
    else if (a === "--limit") limit = Number(argv[++i]);
    else if (a.startsWith("--limit=")) limit = Number(a.slice("--limit=".length));
    else if (a === "--dry-run") dryRun = true;
  }
  if (!slug && !all && limit === null) {
    console.error(
      "❌ Must pass one of: --slug <s>, --all, --limit N (and optional --dry-run)"
    );
    process.exit(1);
  }
  return { slug, all, limit, dryRun };
}

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_WRITE_TOKEN ?? process.env.SANITY_API_READ_TOKEN;

if (!projectId || !dataset) {
  console.error("❌ Missing NEXT_PUBLIC_SANITY_PROJECT_ID or NEXT_PUBLIC_SANITY_DATASET");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  token: token ?? undefined,
  apiVersion: "2025-10-05",
  useCdn: false,
  perspective: "raw",
});

type SanityStandaloneStory = {
  _id: string;
  _createdAt?: string;
  _updatedAt?: string;
  sourceType?: string | null;
  createStoryId?: string | null;
  createStoryUserId?: string | null;
  language?: string | null;
  variant?: string | null;
  region_es?: string | null;
  region_en?: string | null;
  region_de?: string | null;
  region_fr?: string | null;
  region_it?: string | null;
  region_pt?: string | null;
  level?: string | null;
  cefrLevel?: string | null;
  focus?: string | null;
  topic?: string | null;
  journeyEligible?: boolean | null;
  journeyTopic?: string | null;
  journeyOrder?: number | null;
  journeyFocus?: string | null;
  title?: string | null;
  slug?: string | null;
  synopsis?: string | null;
  text?: string | null;
  vocabRaw?: string | null;
  coverAssetUrl?: string | null;
  coverUrl?: string | null;
  audioAssetUrl?: string | null;
  audioUrl?: string | null;
  audioQaStatus?: string | null;
  audioQaScore?: number | null;
  audioQaNotes?: string | null;
  audioQaTranscript?: string | null;
  audioQaCheckedAt?: string | null;
  audioDeliveryQaStatus?: string | null;
  audioDeliveryQaScore?: number | null;
  audioDeliveryQaNotes?: string | null;
  audioDeliveryQaCheckedAt?: string | null;
  storyVocabQualityRaw?: string | null;
  vocabValidationRaw?: string | null;
  published?: boolean | null;
};

const PROJECTION = `
  _id,
  _createdAt,
  _updatedAt,
  sourceType,
  createStoryId,
  createStoryUserId,
  language,
  variant,
  region_es,
  region_en,
  region_de,
  region_fr,
  region_it,
  region_pt,
  level,
  cefrLevel,
  focus,
  topic,
  journeyEligible,
  journeyTopic,
  journeyOrder,
  journeyFocus,
  title,
  "slug": slug.current,
  synopsis,
  text,
  vocabRaw,
  "coverAssetUrl": cover.asset->url,
  coverUrl,
  "audioAssetUrl": audio.asset->url,
  audioUrl,
  audioQaStatus,
  audioQaScore,
  audioQaNotes,
  audioQaTranscript,
  audioQaCheckedAt,
  audioDeliveryQaStatus,
  audioDeliveryQaScore,
  audioDeliveryQaNotes,
  audioDeliveryQaCheckedAt,
  storyVocabQualityRaw,
  vocabValidationRaw,
  published
`;

function pickRegion(d: SanityStandaloneStory): string | null {
  return (
    d.region_es ??
    d.region_en ??
    d.region_de ??
    d.region_fr ??
    d.region_it ??
    d.region_pt ??
    null
  );
}

function parseVocab(raw: string | null | undefined): unknown[] | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildPayload(d: SanityStandaloneStory, slug: string) {
  return {
    id: slug,
    slug,
    sourceType: d.sourceType ?? "sanity",
    createStoryId: d.createStoryId ?? null,
    createStoryUserId: d.createStoryUserId ?? null,
    language: d.language ?? null,
    variant: d.variant ?? null,
    region: pickRegion(d),
    level: d.level ?? null,
    cefrLevel: d.cefrLevel ?? null,
    focus: d.focus ?? null,
    topic: d.topic ?? null,
    journeyEligible: d.journeyEligible ?? false,
    journeyTopic: d.journeyTopic ?? null,
    journeyOrder: d.journeyOrder ?? null,
    journeyFocus: d.journeyFocus ?? null,
    title: d.title ?? "Untitled",
    synopsis: d.synopsis ?? null,
    text: d.text ?? "",
    vocabRaw: d.vocabRaw ?? null,
    vocab: parseVocab(d.vocabRaw),
    cover: d.coverAssetUrl ?? null,
    coverUrl: d.coverUrl ?? null,
    audio: d.audioAssetUrl ?? null,
    audioUrl: d.audioUrl ?? null,
    audioQaStatus: d.audioQaStatus ?? null,
    audioQaScore: d.audioQaScore ?? null,
    audioQaNotes: d.audioQaNotes ?? null,
    audioQaTranscript: d.audioQaTranscript ?? null,
    audioQaCheckedAt: toDate(d.audioQaCheckedAt),
    audioDeliveryQaStatus: d.audioDeliveryQaStatus ?? null,
    audioDeliveryQaScore: d.audioDeliveryQaScore ?? null,
    audioDeliveryQaNotes: d.audioDeliveryQaNotes ?? null,
    audioDeliveryQaCheckedAt: toDate(d.audioDeliveryQaCheckedAt),
    storyVocabQualityRaw: d.storyVocabQualityRaw ?? null,
    vocabValidationRaw: d.vocabValidationRaw ?? null,
    published: d.published ?? false,
    sanityId: d._id,
    migratedFrom: "sanity-live",
    sourceCreatedAt: toDate(d._createdAt),
    sourceUpdatedAt: toDate(d._updatedAt),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    // Exclude Sanity drafts (IDs prefixed with `drafts.`). We migrate the
    // published version only; drafts can be re-saved manually from Sanity if
    // needed.
    const BASE = `_type == "standaloneStory" && !(_id in path("drafts.**"))`;
    let query: string;
    let params: Record<string, unknown> = {};
    if (args.slug) {
      query = `*[${BASE} && slug.current == $slug][0..0]{${PROJECTION}}`;
      params = { slug: args.slug };
    } else if (args.limit !== null && !args.all) {
      query = `*[${BASE}] | order(_createdAt asc) [0...$limit]{${PROJECTION}}`;
      params = { limit: args.limit };
    } else {
      query = `*[${BASE}] | order(_createdAt asc) {${PROJECTION}}`;
    }

    console.log("📡 Fetching from Sanity...");
    const docs = await sanity.fetch<SanityStandaloneStory[]>(query, params);
    console.log(`   fetched: ${docs.length}`);
    console.log(`   mode: ${args.dryRun ? "DRY RUN (no writes)" : "WRITE"}`);
    console.log("");

    const summary = { create: 0, update: 0, skip: 0 };
    const samples: string[] = [];

    let i = 0;
    for (const d of docs) {
      i++;
      const slug = d.slug;
      if (!slug || typeof slug !== "string" || !slug.trim()) {
        summary.skip++;
        console.log(`   [SKIP no-slug] ${d._id}`);
        continue;
      }

      const existing = await prisma.standaloneStory.findUnique({ where: { id: slug } });
      const kind: "create" | "update" = existing ? "update" : "create";
      summary[kind]++;

      if (samples.length < 8) {
        samples.push(
          `   [${kind.toUpperCase()}] ${slug}  lang=${d.language ?? "-"}  cefr=${d.cefrLevel ?? "-"}  pub=${d.published ?? false}`
        );
      }

      if (!args.dryRun) {
        const payload = buildPayload(d, slug);
        await prisma.standaloneStory.upsert({
          where: { id: slug },
          create: payload,
          update: payload,
        });
        if (i % 25 === 0) console.log(`   ...wrote ${i}/${docs.length}`);
      }
    }

    console.log("");
    console.log(
      `📊 Result: ${summary.create} create, ${summary.update} update, ${summary.skip} skip (total ${docs.length})`
    );
    if (samples.length > 0) {
      console.log("   Sample:");
      for (const s of samples) console.log(s);
      if (docs.length > samples.length) {
        console.log(`   ...and ${docs.length - samples.length} more`);
      }
    }

    if (args.dryRun) {
      console.log("");
      console.log("🟡 Dry run complete. No writes performed.");
    } else {
      console.log("");
      console.log(`✅ Wrote ${summary.create + summary.update} StandaloneStory rows.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error("❌ migrate-standalone-stories failed:", msg);
  process.exit(1);
});
