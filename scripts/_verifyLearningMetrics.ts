/**
 * Corre el cálculo REAL de la sección Aprendizaje (`computeLearningMetrics`)
 * contra la base de producción, con la misma exclusión de usuarios internos
 * que aplica el dashboard, y escupe la tabla. Existe porque el route pide
 * sesión de Clerk y el navegador local no la tiene.
 *
 *   npx tsx scripts/_verifyLearningMetrics.ts [días]
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { computeLearningMetrics } from "../src/lib/learningMetrics";

const p = new PrismaClient();
const days = Number(process.argv[2] ?? 30);
const from = new Date(Date.now() - days * 864e5);
const to = new Date();

function normalizeLanguageCode(value: string): string {
  const v = value.trim().toLowerCase();
  if (v.startsWith("es") || v === "spanish" || v === "castellano") return "es";
  if (v.startsWith("it") || v === "italian" || v === "italiano") return "it";
  if (v.startsWith("de") || v === "german" || v === "deutsch") return "de";
  if (v.startsWith("fr") || v === "french" || v.startsWith("français")) return "fr";
  if (v.startsWith("pt") || v === "portuguese" || v === "português") return "pt";
  if (v.startsWith("en") || v === "english") return "en";
  return v.slice(0, 2);
}

async function main() {
  const internal = (process.env.METRICS_EXCLUDE_USER_IDS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const excludeInternal = internal.length ? { userId: { notIn: internal } } : {};

  const [practiceRows, vocabRows] = await Promise.all([
    p.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        eventType: { in: ["practice_session_started", "practice_session_completed"] },
      },
      select: { userId: true, storySlug: true, eventType: true, metadata: true },
      take: 20000,
    }),
    p.userMetric.findMany({
      where: { ...excludeInternal, createdAt: { gte: from, lte: to }, eventType: "vocab_clicked" },
      select: { userId: true, storySlug: true, metadata: true },
      take: 50000,
    }),
  ]);

  const slugs = Array.from(new Set([
    ...practiceRows.map((r) => r.storySlug),
    ...vocabRows.map((r) => r.storySlug),
  ])).filter(Boolean);
  const plain = slugs.filter((s) => !/^journey[-:]/.test(s));
  const ids = slugs.filter((s) => /^journey[-:]/.test(s)).map((s) => s.replace(/^journey[-:]/, ""));

  const [jSlug, jId, standalone, catalog, userStories] = await Promise.all([
    p.journeyStory.findMany({ where: { slug: { in: plain } }, select: { slug: true, level: true, journey: { select: { language: true } } } }),
    p.journeyStory.findMany({ where: { id: { in: ids } }, select: { id: true, level: true, journey: { select: { language: true } } } }),
    p.standaloneStory.findMany({ where: { slug: { in: plain } }, select: { slug: true, level: true, cefrLevel: true, language: true } }),
    p.catalogStory.findMany({ where: { slug: { in: plain } }, select: { slug: true, level: true, cefrLevel: true, language: true } }),
    p.userStory.findMany({ where: { slug: { in: plain } }, select: { slug: true, language: true } }),
  ]);

  const levelMap = new Map<string, string>();
  const languageMap = new Map<string, string>();
  // Mismo criterio que el route: `cefrLevel` manda y `level` solo entra
  // si tiene forma de codigo CEFR. En StandaloneStory/CatalogStory
  // `level` guarda la banda gruesa (beginner/intermediate/advanced).
  const CEFR_CODE = /^[abc][0-2]$/;
  const putLevel = (k: string | null | undefined, ...cands: Array<string | null | undefined>) => {
    if (!k || levelMap.has(k)) return;
    for (const raw of cands) {
      const v = raw?.trim().toLowerCase();
      if (v && CEFR_CODE.test(v)) { levelMap.set(k, v); return; }
    }
  };
  const putLang = (k: string | null | undefined, v: string | null | undefined) => {
    if (k && v && !languageMap.has(k)) languageMap.set(k, normalizeLanguageCode(v));
  };
  for (const r of jSlug) { putLevel(r.slug, r.level); putLang(r.slug, r.journey?.language); }
  for (const r of jId) {
    const orig = slugs.find((s) => s.replace(/^journey[-:]/, "") === r.id);
    putLevel(orig, r.level); putLang(orig, r.journey?.language);
  }
  for (const r of standalone) { putLevel(r.slug, r.cefrLevel, r.level); putLang(r.slug, r.language); }
  for (const r of catalog) { putLevel(r.slug, r.cefrLevel, r.level); putLang(r.slug, r.language); }
  for (const r of userStories) putLang(r.slug, r.language);

  const m = computeLearningMetrics({
    practiceRows, vocabRows, languageMap, levelMap,
    normalizeLanguage: normalizeLanguageCode,
  });

  console.log(`\n=== APRENDIZAJE · últimos ${days} días (internos excluidos: ${internal.length}) ===\n`);
  console.log(`Práctica: ${m.practice.started} iniciadas · ${m.practice.completed} completadas · ${m.practice.completionRate}% finalización`);
  console.log(`Precisión media: ${m.practice.avgAccuracyPercent}% · usuarios: ${m.practice.practicingUsers}`);
  console.log(`\nPor modo:`);
  console.table(m.practice.byMode);
  console.log(`Distribución de precisión:`);
  console.table(m.practice.accuracyDistribution);
  console.log(`\nVocabulario: ${m.vocab.lookups} consultas · ${m.vocab.uniqueWords} palabras · ${m.vocab.lookingUpUsers} usuarios · ${m.vocab.lookupsPerReader}/usuario`);
  console.log(`Fuente:`); console.table(m.vocab.bySource);
  console.log(`Top palabras:`); console.table(m.vocab.topWords.slice(0, 12));
  console.log(`\nPor idioma:`); console.table(m.byLanguage);
  console.log(`Por nivel:`); console.table(m.byLevel);

  console.log(`\nsin nivel: ${m.levelUnattributed.sessions}/${practiceRows.length} filas ` +
    `(${m.levelUnattributed.placeholder} sin historia, ${m.levelUnattributed.unknownStory} sin CEFR)`);
}
main().finally(() => p.$disconnect());
