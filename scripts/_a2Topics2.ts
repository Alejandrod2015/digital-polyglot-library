import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { assertTopicsGrounded, type TopicProposal } from "@/lib/topicEvidence";
import { PrismaClient } from "../src/generated/prisma";

/** Traveler ES/LATAM A2: siete campos lexicos ANCHOS, uno por destino. */
export const PROPOSALS: TopicProposal[] = [
  { label: "Houses & Chores", slug: "houses-and-chores", evidence: [
      "I wish to talk to neighbours", "I started to learn Spanish for my new girlfriend" ] },
  { label: "Work & Bosses", slug: "work-and-bosses", evidence: [
      "full business meetings", "for my job and friends" ] },
  { label: "Music & Practice", slug: "music-and-practice", evidence: [
      "enlarge my social, language and cultural skills", "fun and interactive method" ] },
  { label: "Health & Remedies", slug: "health-and-remedies", evidence: [
      "every time she need something", "seem to understand, reached for or fixed" ] },
  { label: "Crafts & Colours", slug: "crafts-and-colours", evidence: [
      "from the real pepole living there point of view", "understand and use slang" ] },
  { label: "Arguments & Apologies", slug: "arguments-and-apologies", evidence: [
      "he never seems to translate the way I would translate myself", "know peoples secrets" ] },
  { label: "Travel & Goodbyes", slug: "travel-and-goodbyes", evidence: [
      "I want to have my own conversations with her", "want to try all the chances which are available" ] },
];

if (require.main === module) {
  (async () => {
    const prisma = new PrismaClient();
    const js = await prisma.journey.findMany({ where: { language: "spanish", status: { not: "archived" } }, select: { topics: true } });
    const slugs = [...new Set(js.flatMap((j) => j.topics))];
    const tops = await prisma.topic.findMany({ where: { slug: { in: slugs } }, select: { label: true } });
    await assertTopicsGrounded({ language: "spanish", proposals: PROPOSALS, existingLabels: tops.map((t) => t.label), prisma });
    const choque = await prisma.topic.findMany({ where: { slug: { in: PROPOSALS.map(p => p.slug!) } }, select: { slug: true, label: true } });
    console.log("slugs ya ocupados:", choque.length ? choque : "ninguno");
    const dup = await prisma.topic.findMany({ where: { label: { in: PROPOSALS.map(p => p.label) } }, select: { slug: true, label: true } });
    console.log("labels ya usados:", dup.length ? dup : "ninguno");
    await prisma.$disconnect();
  })().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
}
