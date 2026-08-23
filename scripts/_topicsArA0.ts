import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { assertTopicsGrounded, type TopicProposal } from "../src/lib/topicEvidence";
import { PrismaClient } from "../src/generated/prisma";

export const PROPOSALS: TopicProposal[] = [
  { label: "Visits & Greetings", slug: "visits-and-greetings",
    evidence: ["I wish to talk to neighbours"] },
  { label: "Errands & Favours", slug: "errands-and-favours",
    evidence: ["every time she need something"] },
  { label: "Understanding & Repeating", slug: "understanding-and-repeating",
    evidence: ["the way I would translate myself"] },
  { label: "Secrets & Worries", slug: "secrets-and-worries",
    evidence: ["and know peoples secrets"] },
  { label: "Couples & Introductions", slug: "couples-and-introductions",
    evidence: ["I started to learn Spanish for my new girlfriend"] },
  { label: "Work & Tiredness", slug: "work-and-tiredness",
    evidence: ["for my job and friends"] },
  { label: "Nicknames & Teasing", slug: "nicknames-and-teasing",
    evidence: ["WAY funnier then him"] },
];

async function main() {
  const p = new PrismaClient();
  const js = await p.journey.findMany({
    where: { language: "spanish", status: { in: ["active", "draft"] } },
    select: { topics: true },
  });
  const slugs = [...new Set(js.flatMap((j) => j.topics))];
  const labels = await p.topic.findMany({ where: { slug: { in: slugs } }, select: { label: true } });
  await assertTopicsGrounded({
    language: "spanish",
    proposals: PROPOSALS,
    existingLabels: labels.map((l) => l.label!).filter(Boolean).sort(),
    prisma: p,
  });
  console.log("PORTON DE TEMAS: OK");
  await p.$disconnect();
}
main().catch(async (e) => { console.error("\n" + e.message); process.exit(1); });
