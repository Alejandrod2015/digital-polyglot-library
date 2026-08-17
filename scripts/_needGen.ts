import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { splitSentences } from "../src/lib/exampleSentence";
const p = new PrismaClient();
const norm = (w: string) => w.trim().toLowerCase();
const MAX = 100;
const isSingleClean = (s: string) => {
  const t = (s || "").trim();
  return !!t && t.length <= MAX && splitSentences(t).length === 1;
};

async function main() {
  const favs = await p.favorite.findMany({ select: { id: true, word: true, translation: true, language: true, exampleSentence: true, storySlug: true } });

  // Resolver "vivo"
  const jids = [...new Set(favs.map((f) => f.storySlug).filter((s): s is string => !!s?.startsWith("journey-")).map((s) => s.slice(8)))];
  const slugs = [...new Set(favs.map((f) => f.storySlug).filter((s): s is string => !!s && !s.startsWith("journey-")))];
  const liveJourneyIds = new Set<string>();
  const liveSlugs = new Set<string>();
  if (jids.length) {
    const rows = await p.journeyStory.findMany({ where: { id: { in: jids }, status: "published", journey: { status: { notIn: ["archived", "draft"] } } }, select: { id: true } });
    rows.forEach((r) => liveJourneyIds.add(`journey-${r.id}`));
  }
  if (slugs.length) {
    const jr = await p.journeyStory.findMany({ where: { slug: { in: slugs }, status: "published", journey: { status: { notIn: ["archived", "draft"] } } }, select: { slug: true } });
    jr.forEach((r) => r.slug && liveSlugs.add(r.slug));
    const sr = await p.standaloneStory.findMany({ where: { slug: { in: slugs } }, select: { slug: true } });
    sr.forEach((r) => r.slug && liveSlugs.add(r.slug));
  }
  const isLive = (slug: string | null) => !!slug && (slug.startsWith("journey-") ? liveJourneyIds.has(slug) : liveSlugs.has(slug));

  // Curado (word+lang) en journeys vivos
  const sets = await p.storyPracticeSet.findMany({
    where: { story: { status: "published", journey: { status: { notIn: ["archived", "draft"] } } } },
    select: { story: { select: { journey: { select: { language: true } } } }, exercises: { select: { word: true } } },
  });
  const curated = new Set<string>();
  for (const s of sets) { const lang = norm(s.story?.journey?.language ?? ""); for (const ex of s.exercises) if (ex.word) curated.add(`${lang}::${norm(ex.word)}`); }

  const need: typeof favs = [];
  for (const f of favs) {
    if (!isLive(f.storySlug)) continue;
    const lang = norm(f.language ?? "");
    if (curated.has(`${lang}::${norm(f.word)}`)) continue; // reusa curado
    if (isSingleClean(f.exampleSentence ?? "")) continue;   // ya limpia
    need.push(f);
  }
  console.log(`Favoritos de historias VIVAS que necesitan generación: ${need.length}\n`);
  for (const f of need) console.log(`[${f.language}] ${f.word}  ::  ${f.translation}  ::  actual: "${(f.exampleSentence ?? "").slice(0, 55)}"`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
