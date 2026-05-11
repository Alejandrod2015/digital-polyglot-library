// scripts/migrateSanityMediaToR2.ts
//
// Copies every catalog asset that still lives on cdn.sanity.io into the
// project's R2 bucket and writes the new public URL back into Prisma
// (CatalogBook.coverUrl, CatalogStory.coverUrl/audioUrl, StandaloneStory
// .coverUrl/audioUrl). The Sanity URL is left untouched in the original
// column (`cover` / `audio`) so rollback is just `UPDATE ... SET *Url=NULL`.
//
// Idempotent: every asset uses the Sanity content hash filename as the R2
// key (`media/catalog/{images,audio}/<sanity-filename>`). A duplicate run
// skips assets that already have an *Url populated.
//
// Usage:
//   tsx scripts/migrateSanityMediaToR2.ts [--dry-run] [--only=catalog|standalone]
//                                          [--limit N]

import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
import {
  copyRemoteAssetToObjectStorage,
  getPublicObjectUrl,
  isObjectStorageConfigured,
} from "../src/lib/objectStorage";
import { PrismaClient } from "../src/generated/prisma";

type Args = {
  dryRun: boolean;
  only: "all" | "catalog" | "standalone";
  limit: number | null;
};

function parseArgs(argv: string[]): Args {
  let dryRun = false;
  let only: Args["only"] = "all";
  let limit: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--only=")) {
      const v = a.slice("--only=".length);
      if (v === "catalog" || v === "standalone") only = v;
    } else if (a === "--limit") limit = Number(argv[++i]);
    else if (a.startsWith("--limit=")) limit = Number(a.slice("--limit=".length));
  }
  return { dryRun, only, limit };
}

const SANITY_PREFIX = "https://cdn.sanity.io/";

function isSanity(url: string | null | undefined): url is string {
  return typeof url === "string" && url.startsWith(SANITY_PREFIX);
}

function isImageUrl(url: string): boolean {
  return url.includes("/images/");
}

function contentTypeFor(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function sanityFilename(url: string): string {
  const path = new URL(url).pathname;
  return path.split("/").pop() || "asset";
}

function r2KeyForSanityUrl(url: string): string {
  const kind = isImageUrl(url) ? "images" : "audio";
  return `media/catalog/${kind}/${sanityFilename(url)}`;
}

type Task = {
  scope: string;
  rowId: string;
  field: "coverUrl" | "audioUrl";
  sanityUrl: string;
  r2Key: string;
};

async function buildTaskList(prisma: PrismaClient, only: Args["only"]): Promise<Task[]> {
  const tasks: Task[] = [];

  if (only === "all" || only === "catalog") {
    const books = await prisma.catalogBook.findMany({
      select: { id: true, cover: true, coverUrl: true },
    });
    for (const b of books) {
      if (!b.coverUrl && isSanity(b.cover)) {
        tasks.push({
          scope: "CatalogBook",
          rowId: b.id,
          field: "coverUrl",
          sanityUrl: b.cover,
          r2Key: r2KeyForSanityUrl(b.cover),
        });
      }
    }

    const stories = await prisma.catalogStory.findMany({
      select: { id: true, cover: true, coverUrl: true, audio: true, audioUrl: true },
    });
    for (const s of stories) {
      const sanityCover = isSanity(s.cover) ? s.cover : isSanity(s.coverUrl) ? s.coverUrl : null;
      if (!s.coverUrl && sanityCover && sanityCover === s.cover) {
        tasks.push({
          scope: "CatalogStory",
          rowId: s.id,
          field: "coverUrl",
          sanityUrl: sanityCover,
          r2Key: r2KeyForSanityUrl(sanityCover),
        });
      }
      if (!s.audioUrl && isSanity(s.audio)) {
        tasks.push({
          scope: "CatalogStory",
          rowId: s.id,
          field: "audioUrl",
          sanityUrl: s.audio,
          r2Key: r2KeyForSanityUrl(s.audio),
        });
      }
    }
  }

  if (only === "all" || only === "standalone") {
    const standalones = await prisma.standaloneStory.findMany({
      select: { id: true, cover: true, coverUrl: true, audio: true, audioUrl: true },
    });
    for (const s of standalones) {
      const sanityCover = isSanity(s.cover) ? s.cover : null;
      const sanityCoverUrl = isSanity(s.coverUrl) ? s.coverUrl : null;
      const currentCoverIsR2 = s.coverUrl && !isSanity(s.coverUrl);
      if (!currentCoverIsR2 && (sanityCover || sanityCoverUrl)) {
        const sanityUrl = sanityCover ?? sanityCoverUrl;
        if (sanityUrl) {
          tasks.push({
            scope: "StandaloneStory",
            rowId: s.id,
            field: "coverUrl",
            sanityUrl,
            r2Key: r2KeyForSanityUrl(sanityUrl),
          });
        }
      }
      const sanityAudio = isSanity(s.audio) ? s.audio : null;
      const sanityAudioUrl = isSanity(s.audioUrl) ? s.audioUrl : null;
      const currentAudioIsR2 = s.audioUrl && !isSanity(s.audioUrl);
      if (!currentAudioIsR2 && (sanityAudio || sanityAudioUrl)) {
        const sanityUrl = sanityAudio ?? sanityAudioUrl;
        if (sanityUrl) {
          tasks.push({
            scope: "StandaloneStory",
            rowId: s.id,
            field: "audioUrl",
            sanityUrl,
            r2Key: r2KeyForSanityUrl(sanityUrl),
          });
        }
      }
    }
  }

  return tasks;
}

async function processTask(prisma: PrismaClient, task: Task, dryRun: boolean): Promise<{ skipped: boolean; r2Url: string }> {
  const cachedUrl = getPublicObjectUrl(task.r2Key);
  if (!cachedUrl) throw new Error("Object storage public base url unavailable");

  // HEAD probe so we skip re-uploading content we already pushed in an
  // earlier run (e.g. when a single Sanity asset is reused by several rows).
  let alreadyInR2 = false;
  try {
    const head = await fetch(cachedUrl, { method: "HEAD" });
    alreadyInR2 = head.ok;
  } catch {
    alreadyInR2 = false;
  }

  if (dryRun) {
    return { skipped: alreadyInR2, r2Url: cachedUrl };
  }

  if (!alreadyInR2) {
    const result = await copyRemoteAssetToObjectStorage({
      sourceUrl: task.sanityUrl,
      key: task.r2Key,
      contentType: contentTypeFor(task.sanityUrl),
    });
    if (!result) throw new Error(`Object storage unavailable for ${task.r2Key}`);
  }

  const data = { [task.field]: cachedUrl } as { coverUrl?: string; audioUrl?: string };
  if (task.scope === "CatalogBook") {
    await prisma.catalogBook.update({ where: { id: task.rowId }, data });
  } else if (task.scope === "CatalogStory") {
    await prisma.catalogStory.update({ where: { id: task.rowId }, data });
  } else if (task.scope === "StandaloneStory") {
    await prisma.standaloneStory.update({ where: { id: task.rowId }, data });
  }
  return { skipped: alreadyInR2, r2Url: cachedUrl };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!isObjectStorageConfigured()) {
    console.error("❌ Object storage is not configured. Set MEDIA_STORAGE_* env vars.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const tasks = await buildTaskList(prisma, args.only);
    const sliced = args.limit !== null ? tasks.slice(0, args.limit) : tasks;

    console.log(`Plan: ${sliced.length} assets to migrate (${args.only}, mode=${args.dryRun ? "DRY RUN" : "WRITE"})`);
    const byScope = new Map<string, number>();
    for (const t of sliced) byScope.set(t.scope, (byScope.get(t.scope) ?? 0) + 1);
    for (const [scope, n] of byScope) console.log(`  ${scope}: ${n}`);
    console.log("");

    if (sliced.length === 0) {
      console.log("Nothing to do.");
      return;
    }

    if (args.dryRun) {
      for (const t of sliced.slice(0, 8)) {
        console.log(`  [${t.scope}.${t.field}] ${t.rowId}`);
        console.log(`     from: ${t.sanityUrl}`);
        console.log(`     to:   ${getPublicObjectUrl(t.r2Key)}`);
      }
      if (sliced.length > 8) console.log(`  ...and ${sliced.length - 8} more`);
      console.log("");
      console.log("🟡 Dry run. Pass without --dry-run to apply.");
      return;
    }

    let done = 0;
    let skipped = 0;
    let failed = 0;
    const t0 = Date.now();
    for (const t of sliced) {
      try {
        const r = await processTask(prisma, t, false);
        if (r.skipped) skipped++;
        done++;
        if (done % 10 === 0) {
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          console.log(`  ...${done}/${sliced.length}  (${elapsed}s, ${skipped} reused from R2)`);
        }
      } catch (e) {
        failed++;
        console.error(`  ❌ ${t.scope}.${t.field} ${t.rowId}: ${(e as Error).message}`);
      }
    }

    console.log("");
    console.log(`✅ Done: ${done - failed}/${sliced.length}  (${skipped} reused from R2, ${failed} failed)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
