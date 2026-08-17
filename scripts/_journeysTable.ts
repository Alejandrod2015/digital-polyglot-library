import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

async function main() {
  const journeys = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } }, // live + draft; NUNCA archived
    select: {
      name: true, language: true, variant: true, status: true,
      stories: { select: { status: true, audioUrl: true, practiceSet: { select: { exercises: { select: { payload: true } } } } } },
    },
    orderBy: [{ status: "asc" }, { language: "asc" }, { name: "asc" }],
  });
  console.log("estado | journey | idioma/variante | pub/total | narración | clips práctica");
  for (const j of journeys) {
    const pub = j.stories.filter((s) => s.status === "published").length;
    const narr = j.stories.filter((s) => typeof s.audioUrl === "string" && s.audioUrl.trim()).length;
    let clips = 0;
    for (const s of j.stories) for (const ex of s.practiceSet?.exercises ?? []) {
      const ac = (ex.payload as Record<string, unknown> | null)?.audioClip as Record<string, unknown> | undefined;
      if (typeof ac?.clipUrl === "string" && ac.clipUrl) clips++;
      if (typeof ac?.wordClipUrl === "string" && ac.wordClipUrl) clips++;
    }
    const estado = j.status === "active" ? "LIVE" : "DRAFT";
    console.log(`${estado} | ${j.name} | ${j.language}/${j.variant} | ${pub}/${j.stories.length} | ${narr} | ${clips}`);
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
