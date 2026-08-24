import { PrismaClient } from "../src/generated/prisma";
import { writeFileSync } from "fs";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: "cmsyrge55000732u9oiu8wue3" },
    select: { slug: true, topic: true, slotIndex: true, title: true, synopsis: true, arcType: true, text: true, vocab: true },
  });
  writeFileSync(process.argv[2], JSON.stringify(rows, null, 1));
  console.log(rows.length, "historias volcadas");
  await p.$disconnect();
})();
