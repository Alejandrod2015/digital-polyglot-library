// Cuanto margen hay para quitar vocab sin romper el minimo de 20 del validador.
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function main() {
  const j = await prisma.journey.findFirst({ where: { name: "Expat", status: "active" }, select: { id: true } });
  if (!j) return console.log("journey no encontrado");
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: j.id, status: "published" },
    select: { slug: true, vocab: true },
    orderBy: { slug: "asc" },
  });
  let sinMargen = 0;
  for (const s of stories) {
    const n = Array.isArray(s.vocab) ? (s.vocab as unknown[]).length : 0;
    const margen = n - 20;
    if (margen <= 0) sinMargen += 1;
    console.log(`${String(n).padStart(3)}  margen ${String(margen).padStart(2)}  ${s.slug}`);
  }
  console.log(`\nhistorias: ${stories.length} · sin margen (<=20): ${sinMargen}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
