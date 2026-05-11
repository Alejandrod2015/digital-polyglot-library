import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

async function main() {
  const prisma = new PrismaClient();
  const books = await prisma.catalogBook.count();
  const stories = await prisma.catalogStory.count();
  const standalone = await prisma.standaloneStory.count();
  const standalonePublished = await prisma.standaloneStory.count({ where: { published: true } });
  console.log("CatalogBook rows:        ", books);
  console.log("CatalogStory rows:       ", stories);
  console.log("StandaloneStory rows:    ", standalone, `(${standalonePublished} published)`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
