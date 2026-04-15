// scripts/dedupeBooks.ts
//
// Detects books in Sanity that share the same slug.current and removes the
// duplicate (loser) docs and their orphan stories. Before deleting:
//   1) every loser story is mapped to a canonical sibling under the canonical
//      book (matched by slug.current, or by normalized title when both have
//      no slug and --allow-title-match is set).
//   2) every doc to be deleted is exported to a local NDJSON backup file so
//      the operation is fully reversible (re-import via `sanity dataset import`).
//   3) every inbound reference from docs we are NOT deleting is patched to
//      point at the canonical sibling instead of the loser. Single refs are
//      replaced; references inside arrays are swapped element-by-element.
//
// Usage:
//   npx tsx scripts/dedupeBooks.ts                                # dry-run
//   npx tsx scripts/dedupeBooks.ts --allow-title-match            # dry-run, allow title fallback
//   npx tsx scripts/dedupeBooks.ts --allow-title-match --apply    # execute
//
// Heuristic for picking the canonical book per slug:
//   1) most stories with a populated coverUrl
//   2) tie -> most total stories
//   3) tie -> doc whose _id is "book.<slug>"
//   4) tie -> the OLDEST doc

import { createClient } from "@sanity/client";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_WRITE_TOKEN;

if (!projectId || !dataset || !token) {
  console.error("❌ Missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_WRITE_TOKEN");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: "2024-10-01",
  useCdn: false,
});

const APPLY = process.argv.includes("--apply");
const ALLOW_TITLE_MATCH = process.argv.includes("--allow-title-match");

type BookRow = {
  _id: string;
  _createdAt: string;
  _updatedAt: string;
  title: string | null;
  slug: string | null;
  storyCount: number;
  storiesWithCoverUrl: number;
};

type StoryRow = {
  _id: string;
  title: string | null;
  slug: string | null;
  bookRef: string | null;
};

function normTitle(t: string | null | undefined): string {
  return (t ?? "").toLowerCase().normalize("NFKD").replace(/\s+/g, " ").trim();
}

function isCanonicalBookId(id: string, slug: string): boolean {
  return id === `book.${slug}`;
}

function score(book: BookRow): [number, number, number, number] {
  return [
    book.storiesWithCoverUrl,
    book.storyCount,
    isCanonicalBookId(book._id, book.slug ?? "") ? 1 : 0,
    -Date.parse(book._createdAt || "1970-01-01"),
  ];
}

function compareScores(a: [number, number, number, number], b: [number, number, number, number]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return b[i] - a[i];
  }
  return 0;
}

function isReferenceObj(v: unknown): v is { _ref: string; _type: "reference"; _key?: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { _type?: unknown })._type === "reference" &&
    typeof (v as { _ref?: unknown })._ref === "string"
  );
}

// Walk an arbitrary value and rewrite every reference whose _ref is in remap.
// Returns a list of JSONMatch-style patches: { path: string, set: unknown }
// suitable for patch().setIfMissing/.set semantics. Because Sanity patch paths
// against arrays need keys, we operate on the whole document and emit one
// `set` per top-level field that contains a remapped ref.
function rewriteRefsInDoc(
  doc: Record<string, unknown>,
  remap: Map<string, string>
): Record<string, unknown> | null {
  let mutated = false;
  const clone: Record<string, unknown> = JSON.parse(JSON.stringify(doc));
  function walk(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      if (isReferenceObj(v)) {
        const target = remap.get(v._ref);
        if (target && target !== v._ref) {
          mutated = true;
          return { ...v, _ref: target };
        }
        return v;
      }
      const out: Record<string, unknown> = {};
      for (const [k, vv] of Object.entries(v as Record<string, unknown>)) out[k] = walk(vv);
      return out;
    }
    return v;
  }
  for (const k of Object.keys(clone)) {
    if (k.startsWith("_")) continue;
    clone[k] = walk(clone[k]);
  }
  return mutated ? clone : null;
}

async function main() {
  console.log(`🔎 Mode: ${APPLY ? "APPLY (will MUTATE)" : "DRY-RUN"}  title-fallback=${ALLOW_TITLE_MATCH}`);

  const books = await client.fetch<BookRow[]>(`*[_type == "book" && defined(slug.current) && !(_id in path("drafts.**"))]{
    _id,
    _createdAt,
    _updatedAt,
    title,
    "slug": slug.current,
    "storyCount": count(*[_type == "story" && references(^._id)]),
    "storiesWithCoverUrl": count(*[_type == "story" && references(^._id) && defined(coverUrl) && coverUrl != ""])
  }`);

  const bySlug = new Map<string, BookRow[]>();
  for (const b of books) {
    if (!b.slug) continue;
    const arr = bySlug.get(b.slug) ?? [];
    arr.push(b);
    bySlug.set(b.slug, arr);
  }

  const dupSlugs = [...bySlug.entries()].filter(([, group]) => group.length > 1);
  if (dupSlugs.length === 0) {
    console.log("✅ No duplicate book slugs found. Nothing to do.");
    return;
  }

  console.log(`\nFound ${dupSlugs.length} slug(s) with duplicates.\n`);

  const deletions: { docId: string; reason: string }[] = [];
  // loser story _id -> canonical story _id (used to repoint inbound refs)
  const storyRemap = new Map<string, string>();
  // loser book _id -> canonical book _id
  const bookRemap = new Map<string, string>();
  let abort = false;

  for (const [slug, group] of dupSlugs) {
    const sorted = [...group].sort((a, b) => compareScores(score(a), score(b)));
    const canonical = sorted[0];
    const losers = sorted.slice(1);

    console.log(`📚 slug = "${slug}"`);
    for (const b of sorted) {
      const tag = b._id === canonical._id ? "  ✅ KEEP   " : "  ❌ REMOVE ";
      console.log(
        `${tag}${b._id}  (created ${b._createdAt.slice(0, 10)}, ${b.storyCount} stories, ${b.storiesWithCoverUrl} w/ coverUrl)`
      );
    }

    const canonicalStories = await client.fetch<StoryRow[]>(
      `*[_type == "story" && references($id) && !(_id in path("drafts.**"))]{ _id, title, "slug": slug.current, "bookRef": book._ref }`,
      { id: canonical._id }
    );
    const canonBySlug = new Map<string, string>();
    const canonByTitle = new Map<string, string>();
    for (const s of canonicalStories) {
      if (s.slug) canonBySlug.set(s.slug, s._id);
      const t = normTitle(s.title);
      if (t) canonByTitle.set(t, s._id);
    }

    for (const loser of losers) {
      bookRemap.set(loser._id, canonical._id);

      const loserStories = await client.fetch<StoryRow[]>(
        `*[_type == "story" && references($id) && !(_id in path("drafts.**"))]{ _id, title, "slug": slug.current, "bookRef": book._ref }`,
        { id: loser._id }
      );

      const safeToDelete: StoryRow[] = [];
      const unique: StoryRow[] = [];
      for (const s of loserStories) {
        const canonIdBySlug = s.slug ? canonBySlug.get(s.slug) : undefined;
        const canonIdByTitle =
          ALLOW_TITLE_MATCH && !s.slug ? canonByTitle.get(normTitle(s.title)) : undefined;
        const canonId = canonIdBySlug ?? canonIdByTitle;
        if (canonId) {
          safeToDelete.push(s);
          storyRemap.set(s._id, canonId);
        } else {
          unique.push(s);
        }
      }

      console.log(
        `      → loser ${loser._id}: ${loserStories.length} stories (${safeToDelete.length} safe, ${unique.length} unique)`
      );

      if (unique.length > 0) {
        abort = true;
        console.log(`      ⚠️  unique stories under loser (NOT in canonical):`);
        for (const s of unique) {
          console.log(`           - ${s._id} (slug: ${s.slug ?? "<none>"})`);
        }
      }

      for (const s of safeToDelete) {
        deletions.push({ docId: s._id, reason: `dup story under loser ${loser._id} (slug=${s.slug})` });
        deletions.push({ docId: `drafts.${s._id.replace(/^drafts\./, "")}`, reason: `draft sibling of ${s._id}` });
      }

      deletions.push({ docId: loser._id, reason: `duplicate book (canonical=${canonical._id})` });
      deletions.push({ docId: `drafts.${loser._id.replace(/^drafts\./, "")}`, reason: `draft sibling of loser ${loser._id}` });
    }
    console.log("");
  }

  if (abort) {
    console.error("\n🛑 Aborting: at least one loser has unique stories the canonical does not.");
    process.exit(2);
  }

  // De-duplicate the deletions list by docId.
  const seen = new Set<string>();
  const uniqueDeletions = deletions.filter((d) => (seen.has(d.docId) ? false : (seen.add(d.docId), true)));

  console.log(`Plan: delete ${uniqueDeletions.length} doc(s).`);
  console.log(`Repoint map: ${storyRemap.size} story id(s) + ${bookRemap.size} book id(s).`);

  // -- Find inbound refs (from docs we are NOT deleting) ---------------------
  const allLoserIds = [...storyRemap.keys(), ...bookRemap.keys()];
  const allDeletingIds = new Set(uniqueDeletions.map((d) => d.docId));
  const inboundDocs = await client.fetch<Record<string, unknown>[]>(
    `*[references($ids) && !(_id in $deleting)]`,
    { ids: allLoserIds, deleting: [...allDeletingIds] }
  );
  const remapAll = new Map<string, string>([...storyRemap, ...bookRemap]);
  const repointPatches: { id: string; type: string; rewritten: Record<string, unknown> }[] = [];
  for (const doc of inboundDocs) {
    const rewritten = rewriteRefsInDoc(doc, remapAll);
    if (rewritten) {
      repointPatches.push({
        id: String(doc._id),
        type: String(doc._type),
        rewritten,
      });
    }
  }
  console.log(`Repoint plan: ${repointPatches.length} inbound doc(s) need patches:`);
  for (const p of repointPatches) console.log(`  • ${p._type ?? p.type} ${p.id}`);

  if (!APPLY) {
    console.log("\nℹ️  Dry-run only. Re-run with --apply to execute.");
    return;
  }

  // -- Backup BEFORE any mutation -------------------------------------------
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.resolve(process.cwd(), `scripts/dedupe-backup-${stamp}.ndjson`);
  console.log(`\n💾 Writing backup to ${backupPath}`);
  const backupDocs = await client.fetch<Record<string, unknown>[]>(
    `*[_id in $ids]`,
    { ids: [...allDeletingIds] }
  );
  // Also include the pre-patch versions of repointed docs, so they can be
  // restored too if the user wants to undo the swap.
  const repointBackupDocs = await client.fetch<Record<string, unknown>[]>(
    `*[_id in $ids]`,
    { ids: repointPatches.map((p) => p.id) }
  );
  const fd = fs.openSync(backupPath, "w");
  for (const d of [...backupDocs, ...repointBackupDocs]) {
    fs.writeSync(fd, JSON.stringify(d) + "\n");
  }
  fs.closeSync(fd);
  console.log(`   ✅ Backed up ${backupDocs.length} doc(s) to delete + ${repointBackupDocs.length} doc(s) to repoint.`);
  console.log(`   Restore command (if needed):`);
  console.log(`     npx sanity dataset import ${backupPath} ${dataset} --replace`);

  // -- Repoint inbound refs --------------------------------------------------
  if (repointPatches.length > 0) {
    console.log(`\n🔁 Repointing ${repointPatches.length} inbound doc(s)...`);
    for (const p of repointPatches) {
      const setOps: Record<string, unknown> = {};
      for (const k of Object.keys(p.rewritten)) {
        if (k.startsWith("_")) continue;
        setOps[k] = p.rewritten[k];
      }
      try {
        await client.patch(p.id).set(setOps).commit();
        console.log(`   ✅ patched ${p.id}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`   ❌ patch failed for ${p.id}: ${msg}`);
        console.error("   Aborting before deletes. Backup is intact at:", backupPath);
        process.exit(3);
      }
    }
  }

  // -- Delete ---------------------------------------------------------------
  console.log("\n🗑  Applying deletions (stories first, then books)...");
  const isBookId = (id: string) =>
    /^(drafts\.)?book\./.test(id) ||
    /^(drafts\.)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) === false
      ? false
      : true;
  // Simpler partition: anything NOT matching the story id shape
  const stories = uniqueDeletions.filter((d) => /^(drafts\.)?story\./.test(d.docId) || /^(drafts\.)?[0-9a-f]{8}-/.test(d.docId) && !isBookId(d.docId));
  // Books: explicit book.* prefix OR the two raw UUID losers we know about
  const knownBookUuids = new Set([...bookRemap.keys()]);
  const booksDel = uniqueDeletions.filter(
    (d) =>
      /^(drafts\.)?book\./.test(d.docId) ||
      knownBookUuids.has(d.docId) ||
      knownBookUuids.has(d.docId.replace(/^drafts\./, ""))
  );
  // Re-derive stories as "everything else"
  const bookSet = new Set(booksDel.map((b) => b.docId));
  const storiesFinal = uniqueDeletions.filter((d) => !bookSet.has(d.docId));

  async function runBatch(items: typeof uniqueDeletions, label: string) {
    const CHUNK = 50;
    for (let i = 0; i < items.length; i += CHUNK) {
      const slice = items.slice(i, i + CHUNK);
      const tx = client.transaction();
      for (const d of slice) tx.delete(d.docId);
      try {
        await tx.commit({ visibility: "async" });
        console.log(`   ✅ ${label} batch ${Math.floor(i / CHUNK) + 1}: ${slice.length} doc(s)`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`   ⚠️  ${label} batch ${Math.floor(i / CHUNK) + 1} partial failure: ${msg}`);
      }
    }
  }

  await runBatch(storiesFinal, "stories");
  await runBatch(booksDel, "books  ");

  console.log("\n✅ Done.");
  console.log(`   Backup retained at: ${backupPath}`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("❌ Failed:", msg);
  process.exit(1);
});
