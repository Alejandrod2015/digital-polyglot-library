import { PrismaClient } from "../src/generated/prisma";
import fs from "node:fs";
const p = new PrismaClient();
async function main() {
  const h = await p.journeyStory.findMany({
    where: { journeyId: "cmrr5hnbl000032k1esry5n8g", status: "published" },
    select: { slug: true, title: true, text: true },
  });
  const mapa: Record<string, string> = {};
  for (const s of h) if (s.slug && s.text) mapa[s.slug] = `${s.title}. ${s.text}`;
  fs.writeFileSync("/tmp/textos-spain-a0.json", JSON.stringify(mapa, null, 1));
  console.log("historias volcadas:", Object.keys(mapa).length);
  await p.$disconnect();
}
main();
