/**
 * Espejo de `buildExercisesForUncuratedSavedWords` (story-practice/route.ts)
 * contra la DB real. La funcion vive dentro de un route file y no se puede
 * exportar (Next solo admite exports conocidos), asi que aqui se repite la
 * misma secuencia: cobertura curada -> filtro -> buildPracticeSession.
 *
 * Solo lectura.
 */
import { PrismaClient } from "../src/generated/prisma";
import { buildPracticeSession, type PracticeFavoriteItem } from "../src/lib/practiceExercises";

// `src/lib/prisma` arrastra "server-only", que revienta bajo tsx.
const prisma = new PrismaClient();

const SLUG = "duzen-auf-eigene-gefahr";

async function main() {
  const curated = await prisma.storyPracticeExercise.findMany({
    where: { set: { story: { slug: SLUG, status: "published" } } },
    select: { word: true, featured: true },
  });
  const covered = new Set(
    curated.map((r) => (r.word ?? "").trim().toLowerCase()).filter((w) => w.length > 0)
  );
  console.log(
    `curados=${curated.length} (destacados=${curated.filter((r) => r.featured).length}) palabras distintas=${covered.size}`
  );

  const anyCurated = [...covered][0] ?? "";
  const savedItems: PracticeFavoriteItem[] = [
    // (a) guardada que YA cubre el set curado -> debe quedar fuera
    {
      word: anyCurated,
      translation: "already covered",
      wordType: "noun",
      exampleSentence: null,
      storySlug: SLUG,
      storyTitle: "t",
      sourcePath: `/stories/${SLUG}`,
      language: "german",
      nextReviewAt: null,
      practiceSource: "user_saved",
      voiceId: null,
    },
    // (b) tipica de quick lookup -> debe generar ejercicio
    {
      word: "Dienstausweis",
      translation: "staff ID card",
      wordType: "noun",
      exampleSentence: "Er zeigte seinen Dienstausweis.",
      storySlug: SLUG,
      storyTitle: "t",
      sourcePath: `/stories/${SLUG}`,
      language: "german",
      nextReviewAt: null,
      practiceSource: "user_saved",
      voiceId: null,
    },
  ];

  const missing = savedItems.filter(
    (i) => !covered.has((i.word ?? "").trim().toLowerCase())
  );
  console.log(`guardadas=${savedItems.length} sin cubrir=${missing.length} -> ${missing.map((m) => m.word).join(", ")}`);

  // Pool de distractores: el vocab curado de la historia, igual que en la ruta.
  const story = await prisma.journeyStory.findFirst({
    where: { slug: SLUG, status: "published" },
    select: { vocab: true },
  });
  const vocab = Array.isArray(story?.vocab) ? (story!.vocab as Array<Record<string, unknown>>) : [];
  const companions: PracticeFavoriteItem[] = vocab
    .map((v) => ({
      word: String(v.word ?? ""),
      translation: String(v.definition ?? ""),
      wordType: (v.type as string) ?? null,
      exampleSentence: null,
      storySlug: SLUG,
      storyTitle: "t",
      sourcePath: `/stories/${SLUG}`,
      language: "german",
      nextReviewAt: null,
      practiceSource: "curriculum" as const,
      voiceId: null,
    }))
    .filter((c) => c.word && c.translation);
  console.log(`pool de distractores=${companions.length}`);

  const norm = (v?: string | null) => (typeof v === "string" ? v.trim().toLowerCase() : "");
  const find = (exs: ReturnType<typeof buildPracticeSession>, key: string) =>
    exs.find(
      (ex) =>
        (ex.type === "meaning_in_context" && norm(ex.word) === key) ||
        (ex.type === "listen_choose" && norm(ex.answer) === key)
    ) ?? null;

  const extras = [];
  for (const item of missing) {
    const key = norm(item.word);
    const others = companions.filter((c) => norm(c.word) !== key).slice(0, 6);
    const source = [item, ...others];
    const built =
      find(buildPracticeSession(source, "meaning"), key) ??
      find(buildPracticeSession(source, "listening"), key);
    if (built) extras.push({ ...built, id: `saved-${built.id}` });
  }

  console.log(`ejercicios generados=${extras.length}`);
  for (const ex of extras) {
    const word = ex.type === "meaning_in_context" ? ex.word : ex.type === "listen_choose" ? ex.answer : "(otro)";
    const opts = "options" in ex ? ex.options.length : 0;
    console.log(`  ${ex.id} | ${ex.type} | ${word} | opciones=${opts}`);
  }

  const persistedIds = new Set(
    (await prisma.storyPracticeExercise.findMany({
      where: { set: { story: { slug: SLUG, status: "published" } } },
      select: { id: true },
    })).map((r) => r.id)
  );
  console.log(`colision de ids con los persistidos: ${extras.some((e) => persistedIds.has(e.id))}`);

  // Caso sin oracion de ejemplo: debe caer a listening, no quedarse en cero.
  const sinOracion: PracticeFavoriteItem = { ...savedItems[1], word: "Wohnungsgeberbestaetigung", exampleSentence: null };
  const k = norm(sinOracion.word);
  const fallback =
    find(buildPracticeSession([sinOracion, ...companions.slice(0, 6)], "meaning"), k) ??
    find(buildPracticeSession([sinOracion, ...companions.slice(0, 6)], "listening"), k);
  console.log(`sin exampleSentence -> ${fallback ? fallback.type : "NADA"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
