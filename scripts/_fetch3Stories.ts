import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function main() {
  const slugs = ["la-ligne-corrigee", "le-nom-du-cercle", "le-dossier-gros"];
  for (const slug of slugs) {
    const s = await prisma.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
    console.log("=====", slug, "=====");
    console.log(s?.title);
    console.log(s?.text);
    console.log();
  }
}
main().finally(() => prisma.$disconnect());
