import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

async function main() {
  const journeys = await p.journey.findMany({
    where: { status: "archived" },
    select: {
      name: true, language: true, variant: true,
      stories: {
        select: { audioUrl: true, practiceSet: { select: { exercises: { select: { payload: true } } } } },
      },
    },
    orderBy: [{ language: "asc" }, { name: "asc" }, { variant: "asc" }],
  });
  console.log("journey | idioma/variante | #hist | narración(mp3) | clips práctica");
  for (const j of journeys) {
    const narr = j.stories.filter((s) => typeof s.audioUrl === "string" && s.audioUrl.trim()).length;
    let clips = 0;
    for (const s of j.stories) for (const ex of s.practiceSet?.exercises ?? []) {
      const ac = (ex.payload as Record<string, unknown> | null)?.audioClip as Record<string, unknown> | undefined;
      if (typeof ac?.clipUrl === "string" && ac.clipUrl) clips++;
      if (typeof ac?.wordClipUrl === "string" && ac.wordClipUrl) clips++;
    }
    console.log(`${j.name} | ${j.language}/${j.variant} | ${j.stories.length} | ${narr} | ${clips}`);
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
