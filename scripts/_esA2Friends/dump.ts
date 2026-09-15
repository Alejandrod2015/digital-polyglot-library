// Solo lectura: vuelca journeys live+draft, temas y motivaciones beta de español.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { status: { in: ["active", "draft"] } }, select: { id: true, name: true, language: true, variant: true, typeSlug: true, levels: true, topics: true, status: true, stories: { select: { topic: true, slotIndex: true, title: true, text: true, synopsis: true, vocab: true } } } });
  const topics = await p.topic.findMany({ select: { slug: true, label: true } });
  const beta = await p.betaSignup.findMany({ where: { targetLanguage: { contains: "panish", mode: "insensitive" } }, select: { motivation: true, applicationReason: true, learningGoal: true, topicInterests: true, currentLevel: true } });
  const out = process.argv[2];
  fs.writeFileSync(out, JSON.stringify({ js, topics, beta }, null, 1));
  console.log(js.length, "journeys", topics.length, "topics", beta.length, "beta ES");
  await p.$disconnect();
})();
