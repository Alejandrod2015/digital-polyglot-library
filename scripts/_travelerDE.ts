import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const js = await p.journey.findMany({
    where: { status: "draft", name: "Traveler", variant: "germany" },
    select: { id: true, name: true, variant: true, levels: true, topics: true, storiesPerTopic: true,
      createdAt: true, updatedAt: true, createdBy: true,
      stories: { select: { status: true, audioUrl: true, title: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  for (const j of js) {
    const narr = j.stories.filter((s) => typeof s.audioUrl === "string" && s.audioUrl.trim());
    console.log(`\n=== ${j.id} ===`);
    console.log(`variante: ${j.variant}  | niveles=${j.levels.length} temas=${j.topics.length} spt=${j.storiesPerTopic}`);
    console.log(`creado: ${j.createdAt.toISOString().slice(0,10)}  actualizado: ${j.updatedAt.toISOString().slice(0,10)}`);
    console.log(`niveles: [${j.levels.join(", ")}]  temas: [${j.topics.join(", ")}]`);
    console.log(`historias totales: ${j.stories.length}  con narración: ${narr.length}`);
    console.log(`createdBy: ${j.createdBy ?? "-"}`);
    if (narr.length) narr.slice(0,5).forEach((s) => console.log(`   narrada: ${s.slug}; ${s.title}`));
    const byStatus: Record<string, number> = {};
    for (const s of j.stories) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    console.log(`estados historias: ${JSON.stringify(byStatus)}`);
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
