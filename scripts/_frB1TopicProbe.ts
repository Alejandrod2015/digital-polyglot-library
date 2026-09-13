/** Sonda de solo lectura (Friends FR B1): porton de temas en modo journey-level y escalera. No escribe nada. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";
import { assertLadderContiguous } from "../src/lib/journeyLadder";
const prisma = new PrismaClient();
const TEMAS = ["Careers & Ambitions", "Advice & Opinions", "Money & Debts", "Rumours & Reputation", "Dating & Romance", "Stress & Burnout", "Pride & Envy"];
const slug = (l: string) => l.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
async function main() {
  const todos = await prisma.journey.findMany({ select: { id: true, name: true, language: true, variant: true, levels: true, status: true, topics: true, typeSlug: true } });
  assertLadderContiguous({ name: "Friends", language: "french", variant: "france", levels: ["b1"] } as any, todos as any);
  console.log("ESCALERA OK");
  const existentes = todos.filter((j) => j.language === "french" && j.status !== "archived").flatMap((j) => j.topics);
  const labels = (await prisma.topic.findMany({ where: { slug: { in: existentes } }, select: { label: true } })).map((t) => t.label);
  for (const l of TEMAS) {
    const s = await prisma.topic.findFirst({ where: { slug: slug(l) }, select: { label: true } });
    const b = await prisma.topic.findFirst({ where: { label: l }, select: { slug: true } });
    console.log(l.padEnd(22), slug(l).padEnd(22), s ? `slug existe con label "${s.label}"` : "slug libre", b && b.slug !== slug(l) ? `CHOQUE label en ${b.slug}` : "");
  }
  await assertTopicsGrounded({ language: "French", proposals: TEMAS.map((label) => ({ label, slug: slug(label) })), journeyEvidence: ["I plan to move there in 6-8 months", "still struggle feeling  confident with my comprehension"], existingLabels: labels, prisma });
  console.log("PORTON OK");
}
main().catch((e) => { console.error("FALLO:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
