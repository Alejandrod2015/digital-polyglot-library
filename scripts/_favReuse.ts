import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const norm = (w: string) => w.trim().toLowerCase();

async function main() {
  // Curated (word+language) -> tiene sentence + clipUrl (live journeys published)
  const sets = await p.storyPracticeSet.findMany({
    where: { story: { status: "published", journey: { status: { notIn: ["archived", "draft"] } } } },
    select: { story: { select: { journey: { select: { language: true } } } }, exercises: { select: { word: true, sentence: true, payload: true } } },
  });
  const curated = new Map<string, { sentence: string; hasClip: boolean }>();
  for (const s of sets) {
    const lang = s.story?.journey?.language ?? "?";
    for (const ex of s.exercises) {
      if (!ex.word) continue;
      const ac = (ex.payload as Record<string, unknown> | null)?.audioClip as Record<string, unknown> | undefined;
      const hasClip = typeof ac?.clipUrl === "string" && !!ac.clipUrl;
      const sent = (typeof ac?.sentence === "string" ? ac.sentence : ex.sentence) ?? "";
      const k = `${lang}::${norm(ex.word)}`;
      if (!curated.has(k) || (hasClip && !curated.get(k)!.hasClip)) curated.set(k, { sentence: sent, hasClip });
    }
  }

  // Favoritos
  const favs = await p.favorite.findMany({ select: { word: true, language: true, storySlug: true } });
  // resolver idioma de favoritos con storySlug journey-<id> si language null
  const jids = favs.map((f) => f.storySlug).filter((s): s is string => !!s?.startsWith("journey-")).map((s) => s.slice(8));
  const jlang = new Map<string, string>();
  if (jids.length) {
    const rows = await p.journeyStory.findMany({ where: { id: { in: jids } }, select: { id: true, journey: { select: { language: true } } } });
    for (const r of rows) if (r.journey?.language) jlang.set(`journey-${r.id}`, r.journey.language);
  }

  let reuseWithClip = 0, reuseNoClip = 0, needGen = 0, noLang = 0;
  const genSamples: string[] = [];
  for (const f of favs) {
    const lang = f.language ?? (f.storySlug ? jlang.get(f.storySlug) : null);
    if (!lang) { noLang++; continue; }
    const c = curated.get(`${lang.toLowerCase()}::${norm(f.word)}`);
    if (c?.hasClip) reuseWithClip++;
    else if (c) reuseNoClip++;
    else { needGen++; if (genSamples.length < 20) genSamples.push(`${f.word} (${lang})`); }
  }
  console.log(`Favoritos: ${favs.length}`);
  console.log(`  REUSAR con clip curado (gratis, ideal): ${reuseWithClip}`);
  console.log(`  reusar oración curada pero SIN clip: ${reuseNoClip}`);
  console.log(`  NECESITAN generación (palabra no curada): ${needGen}`);
  console.log(`  sin idioma resoluble: ${noLang}`);
  console.log(`\nMuestra de los que necesitan generación:`);
  console.log("  " + genSamples.join(", "));
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
