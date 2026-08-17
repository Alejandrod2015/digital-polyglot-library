import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const js = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } }, // live + draft; NUNCA archived
    select: {
      name: true, language: true, variant: true, status: true,
      levels: true, topics: true, storiesPerTopic: true,
      stories: { select: { status: true, audioUrl: true, coverUrl: true,
        practiceSet: { select: { exercises: { select: { payload: true } } } } } },
    },
    orderBy: [{ status: "asc" }, { language: "asc" }, { name: "asc" }],
  });
  console.log("estado|journey|idioma/variante|nivel|estructura|pub|narr|covers|clips");
  for (const j of js) {
    const pub = j.stories.filter((s) => s.status === "published").length;
    const narr = j.stories.filter((s) => (s.audioUrl ?? "").trim()).length;
    const cov = j.stories.filter((s) => (s.coverUrl ?? "").trim()).length;
    let clips = 0;
    for (const s of j.stories) for (const ex of s.practiceSet?.exercises ?? []) {
      const ac = (ex.payload as any)?.audioClip;
      if (ac?.clipUrl) clips++;
      if (ac?.wordClipUrl) clips++;
    }
    const nivel = j.levels.join("/") || "-";
    const estr = `${j.levels.length}×${j.topics.length}×${j.storiesPerTopic}`;
    const est = j.status === "active" ? "LIVE" : "DRAFT";
    console.log(`${est}|${j.name}|${j.language}/${j.variant}|${nivel}|${estr}|${pub}/${j.stories.length}|${narr}|${cov}|${clips}`);
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
