import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: "cmu0dpa3i0007j80ugstn0jf0" },
    select: { slug: true, coverDone: true, coverUrl: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  const withCover = rows.filter((r) => r.coverDone && r.coverUrl);
  const urls = new Set(withCover.map((r) => r.coverUrl));
  console.log(`total historias: ${rows.length}`);
  console.log(`con coverDone+coverUrl: ${withCover.length}`);
  console.log(`URLs distintas: ${urls.size}`);
  console.log(`sin portada: ${rows.filter((r) => !r.coverDone).map((r) => r.slug).join(", ")}`);
  await p.$disconnect();
})();
