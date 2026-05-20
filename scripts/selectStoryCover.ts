/**
 * One-off CLI: pin a previously-generated variant URL as the chosen cover
 * for a JourneyStory. Mirrors `selectVariantUrl` mode of
 * /api/studio/journeys/cover-variants.
 *
 * Usage: tsx scripts/selectStoryCover.ts <storyId> <coverUrl>
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const storyId = process.argv[2];
  const coverUrl = process.argv[3];
  if (!storyId || !coverUrl) {
    console.error("Usage: tsx scripts/selectStoryCover.ts <storyId> <coverUrl>");
    process.exit(2);
  }
  if (!/^https?:\/\//.test(coverUrl)) {
    console.error("coverUrl must be a full URL");
    process.exit(2);
  }
  const r = await prisma.journeyStory.update({
    where: { id: storyId },
    data: { coverUrl, coverDone: true },
    select: { id: true, slug: true, title: true, coverUrl: true, coverDone: true },
  });
  console.log(JSON.stringify(r, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
