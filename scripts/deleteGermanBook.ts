// scripts/deleteGermanBook.ts
//
// Deletes the canonical German book ("colloquial-german-stories", _id
// ec750a86-4cda-471f-b338-76ee5e476590) along with all of its stories,
// drafts and any inbound refs from non-deleted docs. Writes a full NDJSON
// backup before mutating anything.
//
// Usage:
//   npx tsx scripts/deleteGermanBook.ts          # dry-run
//   npx tsx scripts/deleteGermanBook.ts --apply  # execute

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
  console.error("❌ Missing env");
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
const BOOK_ID = "ec750a86-4cda-471f-b338-76ee5e476590";

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);

  const book = await client.fetch<{ _id: string; title: string | null; slug: string | null } | null>(
    `*[_id == $id][0]{ _id, title, "slug": slug.current }`,
    { id: BOOK_ID }
  );
  if (!book) {
    console.error(`❌ Book ${BOOK_ID} not found`);
    process.exit(1);
  }
  console.log(`Book: ${book.title} (slug=${book.slug})`);

  const stories = await client.fetch<{ _id: string; title: string | null; slug: string | null }[]>(
    `*[_type == "story" && references($id) && !(_id in path("drafts.**"))]{ _id, title, "slug": slug.current }`,
    { id: BOOK_ID }
  );
  console.log(`Stories under book: ${stories.length}`);
  for (const s of stories) console.log(`  - ${s._id}  "${s.title}"`);

  const idsToDelete = [
    book._id,
    `drafts.${book._id}`,
    ...stories.flatMap((s) => [s._id, `drafts.${s._id.replace(/^drafts\./, "")}`]),
  ];

  // Find inbound refs (from docs we are NOT deleting)
  const allTargets = [book._id, ...stories.map((s) => s._id)];
  const inboundDocs = await client.fetch<Record<string, unknown>[]>(
    `*[references($ids) && !(_id in $deleting)]`,
    { ids: allTargets, deleting: idsToDelete }
  );

  console.log(`Inbound refs from ${inboundDocs.length} other doc(s):`);
  for (const d of inboundDocs) console.log(`  - ${d._type} ${d._id}`);

  if (!APPLY) {
    console.log("\nℹ️  Dry-run only. Re-run with --apply to execute.");
    return;
  }

  // Backup
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.resolve(process.cwd(), `scripts/german-backup-${stamp}.ndjson`);
  console.log(`\n💾 Writing backup to ${backupPath}`);
  const backupDocs = await client.fetch<Record<string, unknown>[]>(
    `*[_id in $ids]`,
    { ids: idsToDelete }
  );
  const inboundBackup = inboundDocs;
  const fd = fs.openSync(backupPath, "w");
  for (const d of [...backupDocs, ...inboundBackup]) {
    fs.writeSync(fd, JSON.stringify(d) + "\n");
  }
  fs.closeSync(fd);
  console.log(`   ✅ Backed up ${backupDocs.length} doc(s) to delete + ${inboundBackup.length} inbound doc(s)`);
  console.log(`   Restore: npx sanity dataset import ${backupPath} ${dataset} --replace`);

  // Strip refs from inbound docs (we cannot repoint anywhere — there is no
  // canonical German book to swap to, since we are removing German entirely).
  // Set the field to null where the ref was a single field, or filter the
  // arrays to drop matching items.
  const targetSet = new Set(allTargets);
  function stripRefs(doc: Record<string, unknown>): Record<string, unknown> | null {
    let mutated = false;
    const clone: Record<string, unknown> = JSON.parse(JSON.stringify(doc));
    function walk(v: unknown): unknown {
      if (Array.isArray(v)) {
        const filtered: unknown[] = [];
        for (const item of v) {
          if (
            item &&
            typeof item === "object" &&
            (item as { _type?: unknown })._type === "reference" &&
            typeof (item as { _ref?: unknown })._ref === "string" &&
            targetSet.has((item as { _ref: string })._ref)
          ) {
            mutated = true;
            continue;
          }
          filtered.push(walk(item));
        }
        return filtered;
      }
      if (v && typeof v === "object") {
        if (
          (v as { _type?: unknown })._type === "reference" &&
          typeof (v as { _ref?: unknown })._ref === "string" &&
          targetSet.has((v as { _ref: string })._ref)
        ) {
          mutated = true;
          return null;
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

  for (const doc of inboundDocs) {
    const stripped = stripRefs(doc);
    if (!stripped) continue;
    const setOps: Record<string, unknown> = {};
    const unsetOps: string[] = [];
    for (const k of Object.keys(stripped)) {
      if (k.startsWith("_")) continue;
      const val = stripped[k];
      if (val === null) unsetOps.push(k);
      else setOps[k] = val;
    }
    try {
      let p = client.patch(String(doc._id));
      if (Object.keys(setOps).length > 0) p = p.set(setOps);
      if (unsetOps.length > 0) p = p.unset(unsetOps);
      await p.commit();
      console.log(`   ✅ stripped refs from ${doc._id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ patch failed for ${doc._id}: ${msg}`);
      console.error(`   Aborting before deletes. Backup at: ${backupPath}`);
      process.exit(3);
    }
  }

  console.log("\n🗑  Deleting docs...");
  const CHUNK = 50;
  for (let i = 0; i < idsToDelete.length; i += CHUNK) {
    const slice = idsToDelete.slice(i, i + CHUNK);
    const tx = client.transaction();
    for (const id of slice) tx.delete(id);
    try {
      await tx.commit({ visibility: "async" });
      console.log(`   ✅ batch ${Math.floor(i / CHUNK) + 1}: ${slice.length} doc(s)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ⚠️  batch ${Math.floor(i / CHUNK) + 1} partial failure: ${msg}`);
    }
  }

  console.log("\n✅ Done.");
  console.log(`   Backup: ${backupPath}`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("❌ Failed:", msg);
  process.exit(1);
});
