/**
 * Sync the curated vocabulary of the 4 `sanity-local-dump` catalog books
 * from the static dump (`src/data/books/*.ts`) into the Studio DB
 * (`CatalogStory.vocab`).
 *
 * WHY: the 2026-05-22 curation pass (commit e90e5d25, "vocab fixes +
 * character names scrubbed") landed only in the static dump, 11 days after
 * those books were migrated into the DB on 2026-05-11. The web reader serves
 * the DB, so it has been showing the pre-curation vocabulary ever since:
 * ~500 fewer entries in three books, plus character names ("Tomás", "Clara")
 * and function words ("algo", "casa", "noche") still listed as vocabulary in
 * the Argentinian beginners book.
 *
 * SCOPE: writes `vocab` and nothing else. Never touches text, audio, covers
 * or metadata. Verified beforehand that the narrative text is identical in
 * both copies (76/80 stories byte-for-byte, the other 4 differ only in an
 * em-dash and a stray space), so the vocabulary can move on its own without
 * desynchronising the audio.
 *
 * Merge rule: the dump's list defines membership and order; any `type` /
 * `example` that exists only on the DB side is carried over onto the
 * matching word so no field is lost.
 *
 *   npx tsx scripts/syncCatalogVocabFromDump.ts            # dry run
 *   npx tsx scripts/syncCatalogVocabFromDump.ts --apply    # writes
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { writeFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "../src/generated/prisma";
import { books } from "../src/data/books";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Only books that came from the dump migration may be synced. The five
// `studio-manual` books were authored after the dump and have no counterpart
// in it; touching them would be a regression.
const ALLOWED_PROVENANCE = "sanity-local-dump";

type VocabItem = {
  word: string;
  definition: string;
  type?: string;
  example?: string;
  surface?: string;
};

/** Reader-equivalent plain text: what StoryContent renders after stripping
 *  tags and collapsing the space a removed </span> leaves before punctuation.
 *  Typographic-only variance (em-dash vs hyphen) is normalised away. */
function readerText(s: string | null): string {
  return (s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?…)])/g, "$1")
    .replace(/([¿¡("])\s+/g, "$1")
    .trim();
}

function asVocab(v: unknown): VocabItem[] {
  return Array.isArray(v) ? (v as VocabItem[]) : [];
}

function key(w: string): string {
  return w.trim().toLowerCase();
}

/** Dump list wins on membership and order; DB-only fields are preserved. */
function merge(dump: VocabItem[], db: VocabItem[]): VocabItem[] {
  const dbByWord = new Map(db.map((v) => [key(v.word ?? ""), v]));
  return dump.map((item) => {
    const prev = dbByWord.get(key(item.word ?? ""));
    const merged: VocabItem = { ...item };
    if (!merged.type && prev?.type) merged.type = prev.type;
    if (!merged.example && prev?.example) merged.example = prev.example;
    if (!merged.surface && prev?.surface) merged.surface = prev.surface;
    return merged;
  });
}

async function main() {
  const backup: Record<string, VocabItem[]> = {};
  const plan: {
    bookSlug: string;
    storySlug: string;
    before: number;
    after: number;
    added: string[];
    removed: string[];
    next: VocabItem[];
  }[] = [];
  const skipped: string[] = [];

  for (const dumpBook of Object.values(books)) {
    const row = await prisma.catalogBook.findUnique({
      where: { slug: dumpBook.slug },
      include: { stories: true },
    });
    if (!row) {
      skipped.push(`${dumpBook.slug}: no existe en la DB`);
      continue;
    }
    if (row.migratedFrom !== ALLOWED_PROVENANCE) {
      skipped.push(`${dumpBook.slug}: provenance='${row.migratedFrom}', fuera de alcance`);
      continue;
    }

    const byslug = new Map(row.stories.map((s) => [s.slug, s]));
    for (const dumpStory of dumpBook.stories) {
      const dbStory = byslug.get(dumpStory.slug);
      if (!dbStory) {
        skipped.push(`${dumpBook.slug}/${dumpStory.slug}: no existe en la DB`);
        continue;
      }
      // Guard: only sync when both copies tell the same story. Protects
      // against pairing the wrong row and against a text drift appearing later.
      if (readerText(dumpStory.text) !== readerText(dbStory.text)) {
        skipped.push(`${dumpBook.slug}/${dumpStory.slug}: el texto difiere, NO se toca`);
        continue;
      }

      const dbVocab = asVocab(dbStory.vocab);
      const dumpVocab = asVocab(dumpStory.vocab as unknown);
      const next = merge(dumpVocab, dbVocab);

      const beforeKeys = new Set(dbVocab.map((v) => key(v.word ?? "")));
      const afterKeys = new Set(next.map((v) => key(v.word ?? "")));
      const added = next.filter((v) => !beforeKeys.has(key(v.word ?? ""))).map((v) => v.word);
      const removed = dbVocab.filter((v) => !afterKeys.has(key(v.word ?? ""))).map((v) => v.word);

      backup[dbStory.id] = dbVocab;
      if (added.length === 0 && removed.length === 0 && next.length === dbVocab.length) continue;
      plan.push({
        bookSlug: dumpBook.slug,
        storySlug: dumpStory.slug,
        before: dbVocab.length,
        after: next.length,
        added,
        removed,
        next,
      });
    }
  }

  // Report
  const byBook = new Map<string, { n: number; before: number; after: number; add: number; rem: number }>();
  for (const p of plan) {
    const acc = byBook.get(p.bookSlug) ?? { n: 0, before: 0, after: 0, add: 0, rem: 0 };
    acc.n += 1;
    acc.before += p.before;
    acc.after += p.after;
    acc.add += p.added.length;
    acc.rem += p.removed.length;
    byBook.set(p.bookSlug, acc);
  }

  console.log(APPLY ? "=== APLICANDO ===" : "=== DRY RUN (nada se escribe) ===");
  for (const [slug, a] of byBook) {
    console.log(
      `\n${slug}\n  historias a tocar: ${a.n}  vocab ${a.before} -> ${a.after}  (+${a.add} nuevas, -${a.rem} eliminadas)`
    );
  }
  if (skipped.length) {
    console.log("\n=== OMITIDAS ===");
    skipped.forEach((s) => console.log("  " + s));
  }

  console.log("\n=== MUESTRA (3 historias) ===");
  for (const p of plan.slice(0, 3)) {
    console.log(`\n  ${p.bookSlug}/${p.storySlug}  ${p.before} -> ${p.after}`);
    if (p.added.length) console.log(`    ENTRAN : ${p.added.join(", ")}`);
    if (p.removed.length) console.log(`    SALEN  : ${p.removed.join(", ")}`);
  }

  const totalAdded = plan.reduce((a, c) => a + c.added.length, 0);
  const totalRemoved = plan.reduce((a, c) => a + c.removed.length, 0);
  console.log(
    `\nTOTAL: ${plan.length} historias, +${totalAdded} palabras, -${totalRemoved} palabras (neto ${totalAdded - totalRemoved})`
  );

  if (!APPLY) {
    console.log("\nCorre con --apply para escribir.");
    await prisma.$disconnect();
    return;
  }

  const backupPath = resolve(process.cwd(), "scripts/_backupCatalogVocab.json");
  writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf8");
  console.log(`\nRespaldo del vocab actual: ${backupPath} (${Object.keys(backup).length} historias)`);

  let written = 0;
  for (const p of plan) {
    const story = await prisma.catalogStory.findFirst({
      where: { slug: p.storySlug, book: { slug: p.bookSlug } },
      select: { id: true },
    });
    if (!story) continue;
    await prisma.catalogStory.update({
      where: { id: story.id },
      data: { vocab: p.next as unknown as object },
    });
    written += 1;
  }
  console.log(`Escritas ${written} historias (solo el campo vocab).`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
