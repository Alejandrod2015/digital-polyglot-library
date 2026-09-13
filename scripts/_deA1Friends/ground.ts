// Solo lectura: comprueba los 7 temas propuestos del Friends DE A1 contra el porton de temas y la escalera. No escribe nada.
import { config } from "dotenv";
config({ path: ".env", quiet: true }); config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { assertTopicsGrounded } from "../../src/lib/topicEvidence";
import { assertLadderContiguous } from "../../src/lib/journeyLadder";
const labels = ["Chats & Phone Calls", "Running & Fitness", "Pets & Animal Care", "Clothes & Style", "Birthdays & Surprises", "Moods & Feelings", "Quarrels & Making Up"];
const slug = (l: string) => l.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const prisma = new PrismaClient();
(async () => {
  const todos = await prisma.journey.findMany({ select: { id: true, name: true, language: true, variant: true, levels: true, status: true, topics: true } });
  assertLadderContiguous({ name: "Friends", language: "german", variant: "germany", levels: ["a1"] }, todos);
  console.log("ESCALERA OK");
  const js = todos.filter((j) => j.language === "german" && j.status !== "archived");
  const existing = (await prisma.topic.findMany({ where: { slug: { in: js.flatMap((j) => j.topics) } }, select: { label: true } })).map((t) => t.label);
  await assertTopicsGrounded({ language: "German", proposals: labels.map((label) => ({ label, slug: slug(label) })),
    journeyEvidence: ["Now I would like to reconnect with my friends", "I made a lot of German friends", "to be able to read and possibly correspond in German"], existingLabels: existing, prisma });
  for (const l of labels) {
    const a = await prisma.topic.findFirst({ where: { OR: [{ slug: slug(l) }, { label: l }] }, select: { slug: true, label: true } });
    console.log(l, "->", slug(l), a ? `CHOCA con ${a.slug}=${a.label}` : "libre");
  }
  console.log("GROUNDED OK"); await prisma.$disconnect();
})().catch((e) => { console.error("FALLA:", e.message); process.exit(1); });
