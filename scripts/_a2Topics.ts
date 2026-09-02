import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { assertTopicsGrounded, type TopicProposal } from "@/lib/topicEvidence";
import { PrismaClient } from "../src/generated/prisma";

export const PROPOSALS: TopicProposal[] = [
  { label: "Rooms & Renting", slug: "rooms-and-renting", evidence: [
      "I wish to talk to neighbours",
      "I started to learn Spanish for my new girlfriend" ] },
  { label: "Work & Shifts", slug: "work-and-shifts", evidence: [
      "full business meetings",
      "for my job and friends" ] },
  { label: "Rehearsals & Nerves", slug: "rehearsals-and-nerves", evidence: [
      "enlarge my social, language and cultural skills",
      "fun and interactive method" ] },
  { label: "Illness & Remedies", slug: "illness-and-remedies", evidence: [
      "every time she need something",
      "seem to understand, reached for or fixed" ] },
  { label: "Paint & Workshops", slug: "paint-and-workshops", evidence: [
      "from the real pepole living there point of view",
      "understand and use slang" ] },
  { label: "Arguments & Apologies", slug: "arguments-and-apologies", evidence: [
      "he never seems to translate the way I would translate myself",
      "know peoples secrets" ] },
  { label: "Goodbyes & Promises", slug: "goodbyes-and-promises", evidence: [
      "I want to have my own conversations with her",
      "want to try all the chances which are available" ] },
];

if (require.main === module) {
  (async () => {
    const prisma = new PrismaClient();
    const js = await prisma.journey.findMany({ where: { language: "spanish", status: { not: "archived" } }, select: { topics: true } });
    const slugs = [...new Set(js.flatMap((j) => j.topics))];
    const tops = await prisma.topic.findMany({ where: { slug: { in: slugs } }, select: { label: true } });
    await assertTopicsGrounded({ language: "spanish", proposals: PROPOSALS, existingLabels: tops.map((t) => t.label), prisma });
    console.log("OK: los siete temas citan una motivacion real.");
    await prisma.$disconnect();
  })().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
}
