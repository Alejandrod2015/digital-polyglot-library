import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { writeFileSync } from "fs";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: "cmu04ereh000732z7px7naqa2", NOT: { audioUrl: null } },
    select: { slug: true, title: true, text: true, audioUrl: true },
    orderBy: [{ slotIndex: "asc" }],
  });
  const manifest = rows.map(r => ({ slug: r.slug, text: `${r.title}. ${r.text}`, url: r.audioUrl }));
  writeFileSync("/tmp/_coverageManifest.json", JSON.stringify(manifest, null, 1));
  console.log(manifest.length, "historias en el manifiesto");
})().finally(() => p.$disconnect());
