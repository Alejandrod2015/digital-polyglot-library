// El constructor de tracks salta toda historia sin text, title o slug.
// Y los temas del journey solo se siembran si su slug tiene defaultLevel
// dentro de los niveles del journey. Comprobamos ambas cosas. Solo lee.
import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

async function main() {
  const j = await p.journey.findFirst({
    where: { language: { equals: "portuguese", mode: "insensitive" } },
    include: { stories: { where: { status: "published" } } },
  });
  if (!j) return console.log("no hay journey PT");
  console.log(`journey ${j.name} status=${j.status} levels=[${j.levels}] topics=${j.topics.length}`);
  const sinSlug = j.stories.filter((s) => !s.slug);
  const sinTitle = j.stories.filter((s) => !s.title);
  const sinText = j.stories.filter((s) => !s.text);
  console.log(`  historias publicadas: ${j.stories.length}`);
  console.log(`  sin slug : ${sinSlug.length}${sinSlug.length ? " ← LAS SALTA TODAS" : ""}`);
  console.log(`  sin title: ${sinTitle.length}`);
  console.log(`  sin text : ${sinText.length}`);
  console.log(`  niveles de las historias: ${[...new Set(j.stories.map((s) => s.level))].join(", ")}`);
  console.log(`  temas de las historias  : ${[...new Set(j.stories.map((s) => s.topic))].join(", ")}`);
  console.log(`  temas declarados        : ${j.topics.join(", ")}`);

  // Lo mismo para un journey de español que SÍ funciona, como control.
  const es = await p.journey.findFirst({
    where: { language: { equals: "spanish", mode: "insensitive" }, status: "active" },
    include: { stories: { where: { status: "published" }, take: 3 } },
  });
  console.log(`\ncontrol español: ${es?.name} · slugs de muestra: ${es?.stories.map((s) => s.slug).join(", ")}`);
  console.log(`muestra PT slugs: ${j.stories.slice(0, 3).map((s) => String(s.slug)).join(", ")}`);
}
main().finally(() => p.$disconnect());
