import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    include: { stories: { select: { slotIndex: true, topic: true, title: true, text: true, synopsis: true }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] } },
    orderBy: [{ language: "asc" }, { variant: "asc" }, { name: "asc" }],
  });
  for (const j of js) {
    const s = j.stories.find(x => (x.text ?? "").length > 50);
    console.log(`\n### ${j.status.toUpperCase()} | ${j.name} ${j.language}/${j.variant} ${j.levels.join(",")} | ${j.id}`);
    if (!s) { console.log("  (sin historias escritas)"); continue; }
    console.log("  SIN: " + (s.synopsis ?? "-").slice(0, 260).replace(/\n/g, " "));
    console.log("  TXT: " + (s.text ?? "").slice(0, 320).replace(/\n/g, " "));
  }
  await p.$disconnect();
})();
