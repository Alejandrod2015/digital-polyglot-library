import { prisma } from "@/lib/prisma";
import { writeClient } from "@/sanity/lib/client";

type CreateMirrorSlugRecord = {
  createStoryId: string;
  slug?: string | null;
};

async function main() {
  const mirrors = await writeClient.fetch<CreateMirrorSlugRecord[]>(
    `*[_type == "standaloneStory" && sourceType == "create" && published == true && defined(createStoryId) && defined(slug.current)]{
      createStoryId,
      "slug": slug.current
    }`
  );

  let updated = 0;

  for (const mirror of mirrors) {
    const targetSlug = mirror.slug?.trim();
    if (!mirror.createStoryId || !targetSlug) continue;

    const story = await prisma.userStory.findUnique({
      where: { id: mirror.createStoryId },
      select: { id: true, slug: true },
    });

    if (!story || story.slug === targetSlug) continue;

    const collision = await prisma.userStory.findFirst({
      where: {
        slug: targetSlug,
        NOT: { id: story.id },
      },
      select: { id: true },
    });

    if (collision) {
      console.warn(
        `[sync-create-story-slugs] Skip ${story.id}: target slug "${targetSlug}" already exists on ${collision.id}.`
      );
      continue;
    }

    await prisma.userStory.update({
      where: { id: story.id },
      data: { slug: targetSlug },
    });
    updated += 1;
    console.log(`[sync-create-story-slugs] ${story.slug} -> ${targetSlug}`);
  }

  console.log(`[sync-create-story-slugs] Done. Updated ${updated} story slugs.`);
}

main()
  .catch((error) => {
    console.error("[sync-create-story-slugs] Failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
