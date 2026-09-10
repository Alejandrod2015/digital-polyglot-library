// Solo lectura: temas de los Traveler PT-BR con su etiqueta.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const js = await p.journey.findMany({ where: { language: "portuguese", status: { not: "archived" } }, select: { id: true, name: true, levels: true, status: true, topics: true, typeSlug: true } });
  const labels = new Map((await p.topic.findMany({ where: { slug: { in: js.flatMap(j => j.topics) } }, select: { slug: true, label: true } })).map(t => [t.slug, t.label]));
  for (const j of js) console.log(`${j.levels} ${j.status} ${j.name}/${j.typeSlug}: ` + j.topics.map(t => `${t} (${labels.get(t)})`).join(" · "));
}
main().finally(() => p.$disconnect());
