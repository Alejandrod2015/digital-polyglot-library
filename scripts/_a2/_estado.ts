import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const js = await prisma.journey.findMany({
    where: { language: "spanish", status: { not: "archived" } },
    select: { id: true, name: true, typeSlug: true, variant: true, levels: true, status: true, topics: true,
      stories: { select: { id: true, topic: true, slotIndex: true, title: true, slug: true, status: true, vocab: true, text: true } } },
  });
  for (const j of js) {
    const conTexto = j.stories.filter(s => s.text && String(s.text).length > 50).length;
    const lemas = new Set<string>();
    for (const s of j.stories) for (const v of ((s.vocab as Array<{word?:string}>) ?? [])) if (v?.word) lemas.add(String(v.word).toLowerCase());
    console.log(`${j.id}  ${j.typeSlug}/${j.variant} ${JSON.stringify(j.levels)} ${j.status}  ${conTexto}/${j.stories.length} historias  ${lemas.size} lemas`);
    console.log(`    temas: ${j.topics.join(", ")}`);
  }
})().finally(() => prisma.$disconnect());
