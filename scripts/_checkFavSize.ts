import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.favorite.findMany({
    where: { language: { equals: "german", mode: "insensitive" } },
    select: { word: true, translation: true, wordType: true, exampleSentence: true,
      storySlug: true, storyTitle: true, sourcePath: true, language: true,
      nextReviewAt: true, lastReviewedAt: true, streak: true },
  });
  const bytes = Buffer.byteLength(JSON.stringify(rows), "utf8");
  console.log(`favoritos: ${rows.length}`);
  console.log(`tamano serializado: ${bytes} bytes (${(bytes/1024).toFixed(1)} KB)`);
  console.log(`limite de SecureStore en Android: 2048 bytes`);
  console.log(`lo excede por: ${(bytes/2048).toFixed(0)}x`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
