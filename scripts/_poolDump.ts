import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { writeFileSync } from "fs";
const p = new PrismaClient();
async function main() {
  const r = await p.journeyStory.findMany({
    where: { journey: { language: "portuguese", typeSlug: "traveler", status: { not: "archived" } }, journeyId: { not: "cmsyrge55000732u9oiu8wue3" } },
    select: { vocab: true } });
  const s = new Set<string>();
  for (const x of r) for (const v of ((x.vocab as any[]) ?? [])) s.add(String(v.word).toLowerCase());
  writeFileSync(process.argv[2], JSON.stringify([...s], null, 0));
  console.log(s.size, "palabras del A0");
  await p.$disconnect();
}
main();
