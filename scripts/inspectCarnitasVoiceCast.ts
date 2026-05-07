import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const prisma = new PrismaClient();
  const story = await prisma.journeyStory.findFirst({
    where: { slug: { equals: "carnitas-en-coyoacan", mode: "insensitive" } },
    select: {
      id: true,
      slug: true,
      title: true,
      voiceId: true,
      dialogueSpec: true,
      audioUrl: true,
      audioStatus: true,
      journey: { select: { language: true, variant: true, name: true } },
    },
  });
  if (!story) {
    console.log("NO STORY FOUND with slug carnitas-en-coyoacan");
    const partial = await prisma.journeyStory.findMany({
      where: { slug: { contains: "carnitas", mode: "insensitive" } },
      select: { slug: true, title: true },
      take: 10,
    });
    console.log("partial matches:", partial);
    await prisma.$disconnect();
    return;
  }
  console.log("STORY:", { id: story.id, slug: story.slug, title: story.title });
  console.log("JOURNEY:", story.journey);
  console.log("voiceId (single):", story.voiceId);
  console.log("audioStatus:", story.audioStatus);
  console.log("audioUrl:", story.audioUrl);
  console.log("dialogueSpec:", JSON.stringify(story.dialogueSpec, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
