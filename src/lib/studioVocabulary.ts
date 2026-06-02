/**
 * Vocabulary aggregation across a journey.
 *
 * Reads every JourneyStory's `vocab` JSON column and indexes by lemma so
 * the studio /vocabulary page can show one row per unique word and
 * flag conflicting definitions for the same lemma across stories.
 *
 * Canonical-definition writes go through `setCanonicalDefinition`,
 * which updates every vocab item matching the lemma in the journey
 * with the chosen definition. Uses raw SQL to side-step the Prisma
 * `cast` column drift (schema declares it, prod DB doesn't have it yet).
 */
import { prisma } from "@/lib/prisma";

export type VocabItemRaw = {
  type?: string;
  word?: string;
  surface?: string;
  definition?: string;
};

export type VocabUsage = {
  storyId: string;
  storySlug: string;
  storyTitle: string;
  topic: string;
  level: string;
  definition: string;
  surface?: string;
};

export type VocabRow = {
  /** Lowercased lemma key, used for matching. */
  key: string;
  /** Display word (first non-empty form encountered). */
  word: string;
  /** Most common type across usages. */
  type: string;
  /** Sorted list of distinct definitions (each tied to its usages). */
  definitions: Array<{
    definition: string;
    usages: VocabUsage[];
  }>;
  /** Total story occurrences. */
  occurrences: number;
  /** True when more than one distinct definition was found. */
  hasConflict: boolean;
};

export type JourneySummary = {
  id: string;
  name: string;
  language: string;
  variant: string;
  storyCount: number;
};

/** List journeys for the filter dropdown. */
export async function listJourneysWithVocab(): Promise<JourneySummary[]> {
  const rows = await prisma.journey.findMany({
    where: { status: { not: "archived" } },
    select: {
      id: true,
      name: true,
      language: true,
      variant: true,
      _count: { select: { stories: true } },
    },
    orderBy: [{ language: "asc" }, { name: "asc" }],
  });
  return rows
    .filter((r) => r._count.stories > 0)
    .map((r) => ({
      id: r.id,
      name: r.name,
      language: r.language,
      variant: r.variant,
      storyCount: r._count.stories,
    }));
}

/** Aggregate vocab across all stories in a journey. */
export async function aggregateJourneyVocab(journeyId: string): Promise<VocabRow[]> {
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId },
    select: {
      id: true,
      slug: true,
      title: true,
      topic: true,
      level: true,
      vocab: true,
    },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });

  const byKey = new Map<
    string,
    {
      word: string;
      typeCounts: Map<string, number>;
      defs: Map<string, VocabUsage[]>;
    }
  >();

  for (const s of stories) {
    if (!Array.isArray(s.vocab)) continue;
    for (const v of s.vocab as VocabItemRaw[]) {
      const word = (v.word || "").trim();
      if (!word) continue;
      const key = word.toLowerCase();
      const def = (v.definition || "").trim();
      const usage: VocabUsage = {
        storyId: s.id,
        storySlug: s.slug ?? "",
        storyTitle: s.title ?? s.slug ?? "",
        topic: s.topic ?? "",
        level: s.level ?? "",
        definition: def,
        surface: v.surface || undefined,
      };
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          word,
          typeCounts: new Map(),
          defs: new Map(),
        };
        byKey.set(key, entry);
      }
      const t = (v.type || "unknown").toLowerCase();
      entry.typeCounts.set(t, (entry.typeCounts.get(t) ?? 0) + 1);
      if (!entry.defs.has(def)) entry.defs.set(def, []);
      entry.defs.get(def)!.push(usage);
    }
  }

  const rows: VocabRow[] = [];
  for (const [key, e] of byKey.entries()) {
    const type =
      [...e.typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "unknown";
    const definitions = [...e.defs.entries()]
      .map(([definition, usages]) => ({ definition, usages }))
      .sort((a, b) => b.usages.length - a.usages.length);
    const occurrences = definitions.reduce((sum, d) => sum + d.usages.length, 0);
    const distinctNonEmpty = definitions.filter((d) => d.definition.length > 0).length;
    rows.push({
      key,
      word: e.word,
      type,
      definitions,
      occurrences,
      hasConflict: distinctNonEmpty > 1,
    });
  }

  rows.sort((a, b) => a.key.localeCompare(b.key, "es"));
  return rows;
}

/**
 * Apply a canonical definition for a given lemma across every story in
 * the journey. Updates each story's `vocab` JSON in-place so all items
 * with matching word get the same definition. Returns count of items
 * updated.
 */
export async function setCanonicalDefinition(
  journeyId: string,
  lemma: string,
  definition: string
): Promise<{ storiesTouched: number; itemsUpdated: number }> {
  const key = lemma.toLowerCase().trim();
  if (!key) throw new Error("Empty lemma");
  const def = definition.trim();
  if (!def) throw new Error("Empty definition");

  const stories = await prisma.journeyStory.findMany({
    where: { journeyId },
    select: { id: true, vocab: true },
  });

  let storiesTouched = 0;
  let itemsUpdated = 0;

  for (const s of stories) {
    if (!Array.isArray(s.vocab)) continue;
    const vocab = s.vocab as VocabItemRaw[];
    let dirty = false;
    const next = vocab.map((v) => {
      if ((v.word || "").toLowerCase().trim() === key) {
        if (v.definition !== def) {
          dirty = true;
          itemsUpdated += 1;
          return { ...v, definition: def };
        }
      }
      return v;
    });
    if (dirty) {
      storiesTouched += 1;
      // Raw SQL to avoid Prisma schema/DB drift on the `cast` column.
      await prisma.$executeRaw`
        UPDATE dp_journey_stories_v1
        SET vocab = ${JSON.stringify(next)}::jsonb
        WHERE id = ${s.id}
      `;
    }
  }

  return { storiesTouched, itemsUpdated };
}
