import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function run(){
const A0 = "cmss0fkc40007j8dub1zpa1kc";
const want = process.argv.slice(2);
const st = await prisma.journeyStory.findMany({ where: { journeyId: A0 }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
for (const s of st) {
  const key = `${s.topic}-${s.slotIndex}`;
  if (want.length && !want.includes(key)) continue;
  console.log(`\n########## ${key} · ${s.title} · slug=${s.slug}`);
  console.log(`SYNOPSIS: ${s.synopsis}`);
  console.log(s.text);
}
await prisma.$disconnect();
}
run();
