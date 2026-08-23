import { PrismaClient } from "../src/generated/prisma";

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.standaloneStory.findMany({
    where: { slug: { in: ["las-tapas-son-gratis", "no-quedan-entradas", "lucia-toca-la-nieve", "lucia-llega-a-san-sebastian", "ane-trae-mas-pintxos", "un-funicular-hasta-igueldo"] } },
    select: { slug: true, cefrLevel: true, level: true, variant: true, language: true, journeyTopic: true, journeyEligible: true, published: true },
  });
  if (rows.length === 0) console.log("(ninguna de esas slugs esta en StandaloneStory)");
  for (const r of rows) {
    console.log(`${r.slug.padEnd(30)} lang=${r.language} variant=${r.variant ?? "-"} cefr=${r.cefrLevel ?? "-"} level=${r.level ?? "-"} topic=${r.journeyTopic ?? "-"} elegible=${r.journeyEligible} pub=${r.published}`);
  }
  await prisma.$disconnect();
}

void main();
