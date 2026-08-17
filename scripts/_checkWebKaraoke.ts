import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

async function main() {
  const stories = await p.catalogStory.findMany({
    where: { book: { published: true } },
    select: { slug: true, bookId: true },
  });
  const slugs = stories.map((s) => s.slug);

  // Exactly the query the web books reader runs.
  const hits = await p.journeyStory.findMany({
    where: { slug: { in: slugs }, status: "published" as never },
    select: { slug: true, audioWordTimings: true },
  });
  console.log("published catalog stories:", stories.length);
  console.log("web reader karaoke hits (journeyStory slug match, status=published):", hits.length);
  console.log("  of those, with non-null audioWordTimings:", hits.filter((h) => h.audioWordTimings).length);

  // Any journeyStory sharing a slug, regardless of status
  const anyStatus = await p.journeyStory.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, status: true },
  });
  console.log("journeyStory rows sharing a catalog slug (any status):", anyStatus.length, anyStatus.slice(0, 10));

  const statuses = await p.journeyStory.groupBy({ by: ["status"], _count: { _all: true } });
  console.log("journeyStory status values in DB:", statuses);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
