import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const [slug, url] = process.argv.slice(2);
  const s = await p.journeyStory.findFirst({ where: { slug }, select: { id: true } });
  if (!s) throw new Error("no story " + slug);
  await p.journeyStory.update({ where: { id: s.id }, data: { coverUrl: url, coverDone: true } });
  console.log("cover set:", slug);
  await p.$disconnect();
}
main();
