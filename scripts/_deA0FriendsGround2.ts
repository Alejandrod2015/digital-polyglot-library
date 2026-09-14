import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";
const labels = ["Letters & Invitations","Looks & Memories","Games & Rules","Books & Reading","Music & Singing","Cooking & Hosting","Plans & Decisions"];
const slug = (l: string) => l.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const prisma = new PrismaClient();
(async () => {
  const js = await prisma.journey.findMany({ where: { language: "german", status: { not: "archived" }, id: { not: "cmu047bkz0007326jsgeptkox" } }, select: { topics: true } });
  const existing = (await prisma.topic.findMany({ where: { slug: { in: js.flatMap((j) => j.topics) } }, select: { label: true } })).map((t) => t.label);
  await assertTopicsGrounded({ language: "German", proposals: labels.map((label) => ({ label, slug: slug(label) })),
    journeyEvidence: ["Now I would like to reconnect with my friends", "I made a lot of German friends", "to be able to read and possibly correspond in German"], existingLabels: existing, prisma });
  for (const l of labels) {
    const a = await prisma.topic.findFirst({ where: { OR: [{ slug: slug(l) }, { label: l }] }, select: { slug: true, label: true } });
    console.log(l, "->", slug(l), a ? `CHOCA con ${a.slug}=${a.label}` : "libre");
  }
  console.log("GROUNDED OK"); await prisma.$disconnect();
})().catch((e) => { console.error("FALLA:", e.message); process.exit(1); });
