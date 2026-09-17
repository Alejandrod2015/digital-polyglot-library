// Solo lectura: escalera y porton de temas del Friends IT A1 (Milano), en seco. No escribe nada.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { assertTopicsGrounded } from "../../src/lib/topicEvidence";
import { assertLadderContiguous } from "../../src/lib/journeyLadder";
import { assertJourneyType } from "../../src/lib/journeyType";
const prisma = new PrismaClient();
const CITAS = ["I will be going on a solo trip to Italy", "understand and speak some basic Italian", "as I learn foreign languages"];
const TEMAS = [
  ["pets-and-strays", "Pets & Strays"], ["work-and-shifts", "Work & Shifts"], ["neighbours-and-noise", "Neighbours & Noise"],
  ["bills-and-expenses", "Bills & Expenses"], ["repairs-and-diy", "Repairs & DIY"], ["summer-and-holidays", "Summer & Holidays"],
  ["couples-and-living-together", "Couples & Living Together"],
];
(async () => {
  const todos = await prisma.journey.findMany({ select: { id: true, name: true, language: true, variant: true, levels: true, status: true, topics: true } });
  assertLadderContiguous({ name: "Friends", language: "italian", variant: "italy", levels: ["a1"] }, todos as any);
  console.log("escalera: pasa");
  const it = todos.filter((j) => j.language === "italian" && j.status !== "archived").flatMap((j) => j.topics);
  const previas = (await prisma.topic.findMany({ where: { slug: { in: it } }, select: { label: true } })).map((t) => t.label);
  await assertTopicsGrounded({ language: "Italian", proposals: TEMAS.map(([slug, label]) => ({ slug, label })), journeyEvidence: CITAS, existingLabels: previas, prisma });
  console.log("temas: pasa");
  console.log("tipo:", await assertJourneyType({ typeSlug: "relationships", name: "Friends", prisma }));
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e.message); await prisma.$disconnect(); process.exit(1); });
