import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const js = await p.journey.findMany({ where: { status: "draft" },
    orderBy: [{ language: "asc" }],
    select: { id: true, name: true, language: true, variant: true, levels: true, typeSlug: true, topics: true, city: true,
      stories: { select: { id: true, slug: true, topic: true, slotIndex: true, text: true, audioUrl: true, coverUrl: true } } } });
  for (const j of js) {
    const conTexto = j.stories.filter(s => (s.text ?? "").length > 200).length;
    console.log([j.id, j.language, j.variant ?? "-", (j.levels ?? []).join("/"), j.typeSlug, j.city ?? "-", `${conTexto}/${j.stories.length}`, `temas=${j.topics.length}`, j.name].join(" | "));
  }
  console.log("TOTAL draft:", js.length);
}
main().finally(() => p.$disconnect());
