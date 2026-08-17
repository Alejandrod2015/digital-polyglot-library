import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

// Estructura ACTUAL = 1 nivel × 7 temas × 3 historias/tema.
const isCurrent = (levels: string[], topics: string[], spt: number) =>
  levels.length === 1 && topics.length === 7 && spt === 3;

async function main() {
  const dry = process.argv.includes("--dry");
  const arch = await p.journey.findMany({
    where: { status: "archived" },
    select: { id: true, name: true, language: true, variant: true, levels: true, topics: true, storiesPerTopic: true },
  });
  const toDraft = arch.filter((j) => isCurrent(j.levels, j.topics, j.storiesPerTopic));
  const stay = arch.filter((j) => !isCurrent(j.levels, j.topics, j.storiesPerTopic));

  console.log(`archived total: ${arch.length}`);
  console.log(`\n→ pasan a DRAFT (estructura actual 1×7×3): ${toDraft.length}`);
  for (const j of toDraft) console.log(`   ${j.name} (${j.language}/${j.variant})`);
  console.log(`\n→ quedan ARCHIVED (estructura vieja/distinta): ${stay.length}`);
  for (const j of stay) console.log(`   ${j.name} (${j.language}/${j.variant}) [${j.levels.length}niv×${j.topics.length}tem×${j.storiesPerTopic}]`);

  if (!dry) {
    const ids = toDraft.map((j) => j.id);
    const r = await p.journey.updateMany({ where: { id: { in: ids } }, data: { status: "draft" } });
    console.log(`\n✔ actualizados a draft: ${r.count}`);
  } else {
    console.log(`\n[DRY] no se escribió nada`);
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
