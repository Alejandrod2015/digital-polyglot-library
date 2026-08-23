import { PrismaClient } from "../src/generated/prisma";

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.journeyStory.findMany({
    where: { slug: { in: ["las-tapas-son-gratis", "lucia-llega-a-san-sebastian", "ane-trae-mas-pintxos", "un-funicular-hasta-igueldo", "no-quedan-entradas"] } },
    select: { slug: true, level: true, topic: true, journey: { select: { name: true, variant: true, levels: true, status: true, language: true } } },
  });
  for (const r of rows) {
    const j = r.journey;
    console.log(`${r.slug.padEnd(30)} story.level=${r.level.padEnd(3)} topic=${r.topic.padEnd(26)} journey=${j.name}/${j.variant} levels=${(j.levels ?? []).join(",")} status=${j.status}`);
  }
  await prisma.$disconnect();
}

void main();
