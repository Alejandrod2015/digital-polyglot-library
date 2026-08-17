import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const e = await p.storyPracticeExercise.findFirst({
    where: { type: "match_meaning", set: { story: { journey: { language: { equals: "portuguese", mode: "insensitive" } } } } },
    select: { id: true, word: true, payload: true, set: { select: { story: { select: { slug: true } } } } },
  });
  console.log("historia:", e?.set?.story?.slug, "| word:", e?.word);
  console.log(JSON.stringify(e?.payload, null, 1).slice(0, 900));
}
main().finally(() => p.$disconnect());
