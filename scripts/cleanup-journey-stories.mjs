// Cleanup safe-by-design para JourneyStory.
//
// Targets:
//   1. Empty drafts: slug=null AND title=null AND status=draft → DELETE.
//      Estas filas son basura inequívoca (jamás se publicaron, nadie las
//      puede haber referenciado). 10 filas según el audit.
//
//   2. Italian title duplicates: 3 grupos detectados (Cacio e Pepe,
//      Risotto alla milanese, Trastevere al Tramonto). NO los borra en
//      automático: imprime cuántas Favorites / ContinueListeningEntry /
//      UserMetric apuntan a cada slug para que decidas a mano. Borrar
//      sin esa verificación deja órfanos en denormalized references.
//
// Flujo:
//   - Sin args → DRY RUN. Imprime exactamente qué borraría.
//   - Con --apply → borra los empty drafts dentro de una transaction.
//                   Los dupes italianos se siguen reportando pero no se
//                   tocan a menos que pases también --kill-dupes con un
//                   mapa explícito de slugs a borrar.
//
// Reversibilidad:
//   - JourneyStory cascadea a StoryPracticeSet (única child relation).
//   - Favorite/ContinueListening/UserMetric guardan slug como string sin
//     FK; quedan colgados pero el app ya tolera slug huérfano.
//   - No hay soft-delete. Borrado físico.

import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const KILL_DUPES = process.argv.includes("--kill-dupes");

function rule(label) {
  console.log(`\n${"=".repeat(64)}\n  ${label}\n${"=".repeat(64)}`);
}

async function findEmptyDrafts() {
  return prisma.journeyStory.findMany({
    where: {
      status: "draft",
      slug: null,
      title: null,
    },
    select: {
      id: true,
      level: true,
      topic: true,
      journeyId: true,
      createdAt: true,
      journey: { select: { name: true, language: true } },
    },
    orderBy: [{ journeyId: "asc" }, { createdAt: "asc" }],
  });
}

async function findItalianDupes() {
  // Detecta por title lowercased y journeyId (mismo journey + mismo
  // título = dupe regardless of level). 3 grupos en italian Traveler.
  const all = await prisma.journeyStory.findMany({
    where: {
      title: { not: null },
      journey: { language: "italian" },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      level: true,
      topic: true,
      slotIndex: true,
      status: true,
      coverDone: true,
      coverUrl: true,
      audioUrl: true,
      audioStatus: true,
      journeyId: true,
      createdAt: true,
      updatedAt: true,
      journey: { select: { name: true } },
    },
  });

  const groups = new Map();
  for (const row of all) {
    const key = `${row.journeyId}::${row.title.trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].filter(([, arr]) => arr.length > 1);
}

function score(row) {
  // Highest score = most worth keeping.
  let s = 0;
  if (row.audioUrl && row.audioStatus === "ready") s += 4;
  if (row.coverDone && row.coverUrl) s += 2;
  if (row.status === "published") s += 3;
  if (row.status === "approved") s += 2;
  if (row.status === "qa_pass") s += 1;
  // Tiebreaker: newer updatedAt wins.
  s += row.updatedAt.getTime() / 1e13;
  return s;
}

async function refCounts(slug) {
  if (!slug) return { favorites: 0, continueListening: 0, userMetrics: 0 };
  const [favorites, continueListening, userMetrics] = await Promise.all([
    prisma.favorite.count({ where: { storySlug: slug } }),
    prisma.continueListeningEntry.count({ where: { storySlug: slug } }),
    prisma.userMetric.count({ where: { storySlug: slug } }),
  ]);
  return { favorites, continueListening, userMetrics };
}

async function main() {
  rule(APPLY ? "MODE: APPLY (destructive)" : "MODE: DRY RUN");

  // ── EMPTY DRAFTS ──────────────────────────────────────────────
  rule("Empty drafts (slug=null, title=null, status=draft)");
  const drafts = await findEmptyDrafts();
  console.log(`Found: ${drafts.length}`);
  for (const d of drafts) {
    console.log(
      `  - ${d.id}  journey=${d.journey?.name}/${d.journey?.language}  level=${d.level}  topic=${d.topic}  created=${d.createdAt.toISOString().slice(0, 10)}`,
    );
  }

  if (APPLY && drafts.length > 0) {
    const result = await prisma.$transaction(async (tx) => {
      const r = await tx.journeyStory.deleteMany({
        where: {
          id: { in: drafts.map((d) => d.id) },
        },
      });
      return r;
    });
    console.log(`\n→ Deleted ${result.count} empty drafts.`);
  } else if (drafts.length > 0) {
    console.log(`\n[DRY] would delete ${drafts.length} rows. Pass --apply to execute.`);
  }

  // ── ITALIAN TITLE DUPES ───────────────────────────────────────
  rule("Italian title duplicates (same journey + same title)");
  const dupes = await findItalianDupes();
  console.log(`Found: ${dupes.length} groups\n`);

  const dupeKills = []; // ids we'd nuke if --kill-dupes
  for (const [key, arr] of dupes) {
    const sorted = arr.slice().sort((a, b) => score(b) - score(a));
    const keeper = sorted[0];
    const losers = sorted.slice(1);
    console.log(`  Title: "${keeper.title}"`);
    console.log(
      `    KEEP: ${keeper.slug}  level=${keeper.level}  slot=${keeper.slotIndex}  status=${keeper.status}  cover=${keeper.coverDone}  audio=${keeper.audioStatus}`,
    );
    for (const l of losers) {
      const ref = await refCounts(l.slug);
      const refStr = `favs=${ref.favorites} cont=${ref.continueListening} metrics=${ref.userMetrics}`;
      const danger = ref.favorites + ref.continueListening > 0;
      console.log(
        `    DROP: ${l.slug}  level=${l.level}  slot=${l.slotIndex}  status=${l.status}  cover=${l.coverDone}  audio=${l.audioStatus}  refs=[${refStr}]${danger ? "  ⚠ user references!" : ""}`,
      );
      dupeKills.push({ id: l.id, slug: l.slug, danger });
    }
    console.log("");
  }

  if (APPLY && KILL_DUPES) {
    const safe = dupeKills.filter((k) => !k.danger);
    const unsafe = dupeKills.filter((k) => k.danger);
    if (unsafe.length > 0) {
      console.log(
        `Skipping ${unsafe.length} dupe(s) with active user references:`,
      );
      for (const u of unsafe) console.log(`  - ${u.slug}`);
    }
    if (safe.length > 0) {
      const r = await prisma.$transaction(async (tx) =>
        tx.journeyStory.deleteMany({ where: { id: { in: safe.map((k) => k.id) } } }),
      );
      console.log(`\n→ Deleted ${r.count} duplicate italian stories.`);
    }
  } else if (dupes.length > 0) {
    console.log(
      `[DRY] would consider ${dupeKills.length} dupe(s) for deletion. Pass --apply --kill-dupes to execute (still skips any with user refs).`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
