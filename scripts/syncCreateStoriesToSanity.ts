import "dotenv/config";
import { getCliClient } from "sanity/cli";
import { PrismaClient } from "@/generated/prisma";
import { syncCreateStoryMirror } from "@/lib/createStoryMirror";

const prisma = new PrismaClient();
const sanityClient = getCliClient({
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-10-05",
  useCdn: false,
});

async function main() {
  const stories = await prisma.userStory.findMany({
    orderBy: { createdAt: "desc" },
  });

  let synced = 0;
  for (const story of stories) {
    await syncCreateStoryMirror(story, sanityClient);
    synced += 1;
  }

  console.log(`[sync:create-stories] Synced ${synced} Create stories to Sanity.`);
}

main()
  .catch((error) => {
    console.error("[sync:create-stories] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
