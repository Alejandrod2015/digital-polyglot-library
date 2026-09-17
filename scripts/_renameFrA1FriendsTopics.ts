/**
 * Renombra los temas del FR France A1 Friends para que el journey suene a
 * Friends y no a Expat. Solo toca slugs de tema, labels y journey.topics.
 * No escribe contenido de historia.
 *
 *   npx tsx scripts/_renameFrA1FriendsTopics.ts
 *   npx tsx scripts/_renameFrA1FriendsTopics.ts --apply
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded, type TopicProposal } from "../src/lib/topicEvidence";

const prisma = new PrismaClient();
const JOURNEY_ID = "cmtwz1iop000l32jybeo2jg4x";

const MAP: Array<{ from: string; to: string; label: string }> = [
  { from: "paperwork-and-appointments", to: "group-notes-and-plans", label: "Group Notes & Plans" },
  { from: "hosting-and-guest-care", to: "hosting-and-care", label: "Hosting & Care" },
  { from: "timing-and-deadlines", to: "plans-and-timing", label: "Plans & Timing" },
  { from: "settling-and-belonging", to: "seats-and-tables", label: "Seats & Tables" },
  { from: "invitations-and-boundaries", to: "invites-and-boundaries", label: "Invites & Boundaries" },
  { from: "trust-and-reassurance", to: "trust-and-doubts", label: "Trust & Doubts" },
  { from: "social-circles-and-introductions", to: "circles-and-introductions", label: "Circles & Introductions" },
];

const JOURNEY_EVIDENCE = [
  "Curious about your books and method. I love learning in context, through reading stories and then doing exercises about the stories :)",
  "I received the email invitation and I am hoping this language app is one I'll actually stick with to learn French. I plan to move there in 6-8 months.",
];

const EXISTING_FRENCH_LABELS = [
  "Home & Family",
  "City & Getting Around",
  "Shopping & Money",
  "Work & Study",
  "Food & Drink",
  "Health & Wellbeing",
  "Community & Celebrations",
  "Sports & Games",
  "Talking & Listening",
  "Helping & Favours",
  "Words & Meanings",
  "Parties & Gifts",
  "Houses & Neighbours",
  "Travel & Goodbyes",
];

void (async () => {
  const apply = process.argv.includes("--apply");
  const proposals: TopicProposal[] = MAP.map((m) => ({ label: m.label, slug: m.to }));

  await assertTopicsGrounded({
    language: "french",
    proposals,
    journeyEvidence: JOURNEY_EVIDENCE,
    existingLabels: EXISTING_FRENCH_LABELS,
    prisma,
  });
  console.log("porton de evidencia: OK\n");

  const destinationSlugs = MAP.map((m) => m.to);
  const sourceSlugs = new Set(MAP.map((m) => m.from));
  const collisions = (await prisma.topic.findMany({
    where: { slug: { in: destinationSlugs } },
    select: { slug: true },
  })).filter((t) => !sourceSlugs.has(t.slug));
  if (collisions.length) {
    console.error("ABORTO: slugs destino ya existen:", collisions.map((t) => t.slug).join(", "));
    process.exit(1);
  }

  for (const [i, { from, to, label }] of MAP.entries()) {
    const count = await prisma.journeyStory.count({ where: { journeyId: JOURNEY_ID, topic: from } });
    console.log(`${from} -> ${to}   "${label}"   (${count} historias)`);
    if (!apply) continue;
    await prisma.journeyStory.updateMany({ where: { journeyId: JOURNEY_ID, topic: from }, data: { topic: to } });
    await prisma.topic.upsert({
      where: { slug: to },
      update: { label, isUniversal: false, sortOrder: i },
      create: { slug: to, label, isUniversal: false, sortOrder: i },
    });
  }

  if (apply) {
    await prisma.journey.update({
      where: { id: JOURNEY_ID },
      data: { topics: destinationSlugs },
    });
    await fetch("http://localhost:3000/api/topics/revalidate", { method: "POST" })
      .then(() => console.log("\ncache de etiquetas purgada"))
      .catch(() => console.log("\n(no hay dev server; purga la cache al levantarlo)"));
  }

  console.log(apply ? "APLICADO." : "\nsimulacion: nada escrito. Repite con --apply.");
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
