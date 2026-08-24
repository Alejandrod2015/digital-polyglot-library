/** Replica la consulta del lector SIN el try/catch, para ver por que una
 *  historia acaba en 404. */
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const slug of process.argv.slice(2)) {
    const row = await p.journeyStory.findFirst({
      where: { slug, OR: [{ status: "published" as const }, { journeyId: { in: ["cmsyrge55000732u9oiu8wue3"] } }] },
      select: { id: true, slug: true, title: true, text: true, status: true, journeyId: true },
    });
    console.log(`${slug}: ${row ? `OK id=${row.id} status=${row.status} texto=${row.text?.length ?? 0}` : "NO LO ENCUENTRA"}`);
  }
  const dup = await p.journeyStory.groupBy({ by: ["slug"], _count: { slug: true }, having: { slug: { _count: { gt: 1 } } } });
  console.log("slugs duplicados en toda la tabla:", dup.length ? JSON.stringify(dup) : "ninguno");
  await p.$disconnect();
})();
