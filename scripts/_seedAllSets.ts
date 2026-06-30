import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const prisma = new PrismaClient();
function genId(p: string, i: number): string {
  return `${p}${Date.now().toString(36)}${i.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
(async () => {
  const apply = process.argv.includes("--apply");
  const mole = await prisma.journeyStory.findFirst({ where: { slug: "la-promesa-del-mole" }, select: { journeyId: true } });
  const j = mole!.journeyId;
  const only = process.argv.find(a => a.startsWith("--only="))?.split("=")[1];
  const files = fs.readdirSync("scripts/_sets")
    .filter(f => f.endsWith(".json"))
    .filter(f => !only || f === `${only}.json`)
    .sort();
  let ok = 0;
  for (const f of files) {
    const slug = f.replace(".json", "");
    const exs = JSON.parse(fs.readFileSync(`scripts/_sets/${f}`, "utf8"));
    const story = await prisma.journeyStory.findFirst({ where: { journeyId: j, slug, status: "published" }, select: { id: true } });
    if (!story) { console.log(`✗ ${slug}: story not found`); continue; }
    if (!apply) { console.log(`[dry] ${slug}: ${exs.length} ex`); ok++; continue; }
    const setIds = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM dp_story_practice_sets_v1 WHERE "storyId" = $1`, story.id);
    for (const s of setIds) await prisma.$executeRawUnsafe(`DELETE FROM dp_story_practice_exercises_v1 WHERE "setId" = $1`, s.id);
    await prisma.$executeRawUnsafe(`DELETE FROM dp_story_practice_sets_v1 WHERE "storyId" = $1`, story.id);
    const setId = genId("sps_", 0);
    await prisma.$executeRawUnsafe(`INSERT INTO dp_story_practice_sets_v1 (id, "storyId", locked, "createdAt", "updatedAt") VALUES ($1,$2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, setId, story.id);
    for (let i = 0; i < exs.length; i++) {
      const e = exs[i];
      await prisma.$executeRawUnsafe(
        `INSERT INTO dp_story_practice_exercises_v1 (id,"setId","orderIndex",type,word,sentence,payload,"audioUrl",featured,language,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NULL,true,'spanish',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        genId("spe_", i), setId, i, e.type, e.word, e.sentence, JSON.stringify(e.payload));
    }
    console.log(`✓ ${slug}: ${exs.length} ex (set ${setId})`);
    ok++;
  }
  console.log(`\n${ok}/${files.length} ${apply ? "seeded" : "dry"}`);
  await prisma.$disconnect();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
