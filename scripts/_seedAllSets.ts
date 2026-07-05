import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
import { validateSet } from "./_validateSets";
const prisma = new PrismaClient();
function genId(p: string, i: number): string {
  return `${p}${Date.now().toString(36)}${i.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
(async () => {
  const apply = process.argv.includes("--apply");
  // Journey-agnostic: stories are resolved by slug alone (slugs are unique
  // across the catalog); the A2-anchored journeyId filter blocked A0/A1 seeds.
  const only = process.argv.find(a => a.startsWith("--only="))?.split("=")[1];
  const force = process.argv.includes("--force");
  // Vocab per story (for full-coverage enforcement) from the authoring snapshot.
  const authoring: any[] = fs.existsSync("scripts/_authoring.json")
    ? JSON.parse(fs.readFileSync("scripts/_authoring.json", "utf8")) : [];
  const vocabBySlug = new Map<string, string[]>(
    authoring.map((s: any) => [s.slug, (s.vocab ?? []).map((v: any) => v.word).filter(Boolean)])
  );
  // Coverage fallback for non-A2 journeys: _authoring.json only covers A2;
  // pull vocab from the story row so the seed gate enforces coverage everywhere.
  {
    const slugsToSeed = fs.readdirSync("scripts/_sets").filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""))
      .filter((s) => !only || s === only).filter((s) => !vocabBySlug.has(s));
    if (slugsToSeed.length) {
      const rows = await prisma.journeyStory.findMany({ where: { slug: { in: slugsToSeed } }, select: { slug: true, vocab: true } });
      for (const r of rows) vocabBySlug.set(r.slug!, ((r.vocab as any[]) ?? []).map((v: any) => v.word).filter(Boolean));
    }
  }

  const files = fs.readdirSync("scripts/_sets")
    .filter(f => f.endsWith(".json"))
    .filter(f => !only || f === `${only}.json`)
    .sort();
  let ok = 0;
  for (const f of files) {
    const slug = f.replace(".json", "");
    const exs = JSON.parse(fs.readFileSync(`scripts/_sets/${f}`, "utf8"));
    // GATE: never seed a set that fails the template validator (mix, featured/
    // pool split, translations, audioClip specs, full vocab coverage, …).
    const issues = validateSet(exs, vocabBySlug.get(slug));
    if (issues.length && !force) {
      console.log(`✗ ${slug}: BLOCKED by validator (${issues.length} issue${issues.length === 1 ? "" : "s"}):\n    ` + issues.join("\n    "));
      continue;
    }
    if (issues.length && force) console.log(`! ${slug}: ${issues.length} validator issue(s) overridden by --force`);
    const story = await prisma.journeyStory.findFirst({ where: { slug, status: "published" }, select: { id: true } });
    if (!story) { console.log(`✗ ${slug}: story not found`); continue; }
    if (!apply) { console.log(`[dry] ${slug}: ${exs.length} ex`); ok++; continue; }
    const setIds = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM dp_story_practice_sets_v1 WHERE "storyId" = $1`, story.id);
    for (const s of setIds) await prisma.$executeRawUnsafe(`DELETE FROM dp_story_practice_exercises_v1 WHERE "setId" = $1`, s.id);
    await prisma.$executeRawUnsafe(`DELETE FROM dp_story_practice_sets_v1 WHERE "storyId" = $1`, story.id);
    const setId = genId("sps_", 0);
    await prisma.$executeRawUnsafe(`INSERT INTO dp_story_practice_sets_v1 (id, "storyId", locked, "createdAt", "updatedAt") VALUES ($1,$2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, setId, story.id);
    for (let i = 0; i < exs.length; i++) {
      const e = exs[i];
      const featured = e.featured !== false; // default featured unless explicitly false
      await prisma.$executeRawUnsafe(
        `INSERT INTO dp_story_practice_exercises_v1 (id,"setId","orderIndex",type,word,sentence,payload,"audioUrl",featured,language,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NULL,$8,'spanish',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        genId("spe_", i), setId, i, e.type, e.word, e.sentence, JSON.stringify(e.payload), featured);
    }
    const featCount = exs.filter((e: any) => e.featured !== false).length;
    console.log(`✓ ${slug}: ${exs.length} ex (${featCount} featured) (set ${setId})`);
    ok++;
  }
  console.log(`\n${ok}/${files.length} ${apply ? "seeded" : "dry"}`);
  await prisma.$disconnect();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
